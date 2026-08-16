import { query } from '../db.js';
import { fullConfig, isSupabaseConfigured } from '../config.js';

/** Thrown to abort a crawl cooperatively when the user requests cancel. */
export class CrawlCanceledError extends Error {
  constructor(message = 'تم إلغاء الزحف') {
    super(message);
    this.name = 'CrawlCanceledError';
    this.canceled = true;
  }
}

/**
 * Full knowledge crawl pipeline: discover routes, fetch + render web pages,
 * sync Supabase content, and rebuild the site knowledge prompt.
 *
 * `onProgress` receives `{ phase, text, meta }` entries. `shouldCancel` (optional)
 * is checked at each progress checkpoint; returning true aborts the crawl.
 */
export async function performKnowledgeCrawl({
  websiteId,
  tenantId,
  baseUrl,
  onProgress,
  depth,
  shouldCancel,
}) {
  const emit = (entry) => {
    if (shouldCancel?.()) throw new CrawlCanceledError();
    onProgress?.(entry);
  };

  const { resolveCrawlDepth } = await import('./crawlDepth.js');
  const depthCfg = resolveCrawlDepth(depth);
  const { crawlSite, listPages } = await import('./crawler.js');
  const { pathsFromSiteKnowledge } = await import('./routes.js');
  const { buildSiteKnowledgeFromPages } = await import('./siteKnowledge.js');
  const {
    syncDatabaseContentToIndex,
    buildSiteKnowledgeFromDatabase,
    stripDatabaseKnowledgeBlock,
  } = await import('./databaseSync.js');
  const { fetchLiveDatabaseCatalog } = await import('./liveData.js');

  const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [websiteId]);
  const cfg = fullConfig(rows[0]?.settings || {});

  const extraPaths = pathsFromSiteKnowledge(cfg.siteKnowledge).map((r) => r.path);
  const supabaseConfigured = isSupabaseConfigured(cfg);

  emit({
    phase: 'web',
    text: `زحف صفحات الموقع (${depthCfg.labelAr}) — HTML، sitemap، المتاجر، الروابط الداخلية${depthCfg.crawlSubdomains ? '، النطاقات الفرعية' : ''}`,
  });

  let catalogPaths = [];
  let siteEmbeddedPaths = [];
  if (supabaseConfigured && (depthCfg.id === 'deep' || depthCfg.id === 'medium')) {
    try {
      const { discoverSiteSupabasePaths } = await import('./siteSupabase.js');
      siteEmbeddedPaths = await discoverSiteSupabasePaths(baseUrl, {
        unlimited: depthCfg.dbUnlimited,
      });
      if (siteEmbeddedPaths.length) {
        emit({
          phase: 'db',
          text: `مسارات Supabase المدمج في الموقع: ${siteEmbeddedPaths.length} (مقالات، منح، دورات…)`,
          meta: { paths: siteEmbeddedPaths.length },
        });
      }
    } catch (err) {
      console.warn('[crawl] site embedded path discovery failed:', err.message);
    }
  }

  if (supabaseConfigured) {
    emit({ phase: 'db', text: 'قراءة فهرس Supabase…' });
    try {
      const liveDb = await fetchLiveDatabaseCatalog(cfg, {
        fullSync: depthCfg.dbFullSync,
        unlimited: depthCfg.dbUnlimited,
      });
      catalogPaths = (liveDb.allItems || [])
        .map((i) => i.path)
        .filter((p) => p && String(p).startsWith('/') && !String(p).includes(':'));
      emit({
        phase: 'db',
        text: `فهرس Supabase: ${catalogPaths.length} مسار (${liveDb.schema}) — مزامنة /db فقط`,
        meta: { schema: liveDb.schema, paths: catalogPaths.length },
      });
    } catch (err) {
      console.warn('[crawl] catalog path seed failed:', err.message);
      emit({ phase: 'db', text: `تحذير: فشل قراءة فهرس Supabase — ${err.message}` });
    }
  }

  const mergedExtraPaths = [...new Set([...extraPaths, ...catalogPaths, ...siteEmbeddedPaths])];

  let siteDbSync = { synced: 0, schema: 'none', items: [] };
  let dbCatalogPaths = [...siteEmbeddedPaths];

  // Optional: if the site embeds a database, index it without blocking HTML crawl messaging.
  try {
    const { syncDiscoveredSiteDatabase } = await import('./siteSupabase.js');
    siteDbSync = await syncDiscoveredSiteDatabase({
      baseUrl,
      tenantId,
      websiteId,
      onProgress: supabaseConfigured ? emit : undefined,
      unlimited: depthCfg.dbUnlimited,
    });
    if (siteDbSync.synced > 0) {
      emit({
        phase: 'db',
        text: `فُهرست ${siteDbSync.synced} سجل من قاعدة بيانات مدمجة في الموقع (إضافة إلى صفحات HTML)`,
        meta: { synced: siteDbSync.synced },
      });
    }
    if (siteDbSync.items?.length) {
      dbCatalogPaths = [
        ...new Set([
          ...dbCatalogPaths,
          ...siteDbSync.items.map((i) => i.path).filter(Boolean),
        ]),
      ];
    }
  } catch (err) {
    console.warn('[crawl] site embedded supabase pre-sync failed:', err.message);
  }

  const result = await crawlSite({
    baseUrl,
    tenantId,
    websiteId,
    extraPaths: [...new Set([...mergedExtraPaths, ...dbCatalogPaths])],
    onProgress: emit,
    depth: depthCfg.id,
  });

  let dbSync = { synced: 0, schema: 'none', message: 'زحف الويب فقط — لا توجد قاعدة بيانات' };
  if (supabaseConfigured) {
    emit({ phase: 'db', text: depthCfg.dbUnlimited ? 'مزامنة كامل Supabase (كل السجلات)…' : 'مزامنة محتوى Supabase إلى الفهرس…' });
    dbSync = await syncDatabaseContentToIndex({
      config: cfg,
      tenantId,
      websiteId,
      baseUrl: result.baseUrl || baseUrl,
      fullSync: depthCfg.dbFullSync,
      unlimited: depthCfg.dbUnlimited,
    });
    emit({
      phase: 'db',
      text: `تمت مزامنة ${dbSync.synced} سجل من Supabase (${dbSync.schema})`,
      meta: { synced: dbSync.synced, schema: dbSync.schema },
    });
  } else {
    await query(
      `DELETE FROM indexed_pages WHERE website_id = $1 AND path LIKE '/db/%'`,
      [websiteId]
    );
  }

  let siteDbSyncFinal = siteDbSync;
  if (supabaseConfigured || siteDbSync.synced > 0) {
    try {
      const { syncDiscoveredSiteDatabase } = await import('./siteSupabase.js');
      siteDbSyncFinal = await syncDiscoveredSiteDatabase({
        baseUrl: result.baseUrl || baseUrl,
        tenantId,
        websiteId,
        onProgress: supabaseConfigured ? emit : undefined,
        unlimited: depthCfg.dbUnlimited,
      });
    } catch (err) {
      console.warn('[crawl] site embedded supabase sync failed:', err.message);
    }
  }

  if (siteDbSyncFinal.synced > 0) {
    dbSync = {
      ...dbSync,
      synced: Math.max(dbSync.synced || 0, siteDbSyncFinal.synced),
      schema: siteDbSyncFinal.schema !== 'none' ? siteDbSyncFinal.schema : dbSync.schema,
      siteEmbedded: true,
    };
  }

  emit({ phase: 'merge', text: 'تحديث معلومات الموقع والمسارات…' });

  const pages = await listPages(websiteId);
  const { rows: pageRows } = await query(
    `SELECT path, title, content FROM indexed_pages
      WHERE website_id = $1 AND path NOT LIKE '/db/%'
      ORDER BY path ASC`,
    [websiteId]
  );
  let siteKnowledge = buildSiteKnowledgeFromPages(pageRows, cfg.siteKnowledge);

  if (supabaseConfigured) {
    const liveDb = await fetchLiveDatabaseCatalog(cfg, { fullSync: depthCfg.dbFullSync });
    siteKnowledge = buildSiteKnowledgeFromDatabase(
      liveDb.allItems || [],
      siteKnowledge,
      liveDb.schema
    );
  } else if (siteDbSyncFinal.synced > 0 && siteDbSyncFinal.items?.length) {
    siteKnowledge = buildSiteKnowledgeFromDatabase(
      siteDbSyncFinal.items,
      siteKnowledge,
      siteDbSyncFinal.schema || 'education'
    );
  } else if (siteDbSync.synced > 0 && siteDbSync.items?.length) {
    siteKnowledge = buildSiteKnowledgeFromDatabase(
      siteDbSync.items,
      siteKnowledge,
      siteDbSync.schema || 'education'
    );
  } else {
    siteKnowledge = stripDatabaseKnowledgeBlock(siteKnowledge);
  }

  const merged = {
    ...(rows[0]?.settings || {}),
    knowledgeBaseUrl: result.baseUrl || baseUrl,
    siteKnowledge,
  };
  await query('UPDATE websites SET settings = $1 WHERE id = $2', [merged, websiteId]);

  return {
    ...result,
    supabaseConfigured,
    dbRecordsSynced: dbSync.synced,
    dbSchema: dbSync.schema,
    routesSynced: pages.length,
    catalogPathsSeeded: catalogPaths.length,
    siteKnowledge,
  };
}
