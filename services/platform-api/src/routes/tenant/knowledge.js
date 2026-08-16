import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { query } from '../../db.js';
import { fullConfig } from '../../config.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import { requireWebsite } from '../../services/userDashboard.js';
import { assertCanUploadDocument } from '../../services/plans.js';
import {
  startCrawlJob,
  getCrawlStatus,
  cancelCrawlJob,
} from '../../knowledge/crawlJobManager.js';

const knowledgeDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|txt|md|markdown)$/i.test(file.originalname || '');
    cb(null, ok);
  },
});

export function registerKnowledgeRoutes(router) {
  // ─── GET /v1/me/knowledge/pages ─────────────────────────────
  router.get('/me/knowledge/pages', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { listPages, getPageCount } = await import('../../knowledge/crawler.js');
      const pages = await listPages(req.user.websiteId);
      const count = await getPageCount(req.user.websiteId);
      const visibleCount = pages.filter((p) => !p.excluded_from_ai).length;
      const hiddenCount = pages.length - visibleCount;
      const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [
        req.user.websiteId,
      ]);
      const cfg = fullConfig(rows[0]?.settings || {});
      res.json({
        pages,
        count,
        visibleCount,
        hiddenCount,
        knowledgeBaseUrl: cfg.knowledgeBaseUrl,
        supabaseUrl: cfg.supabaseUrl || '',
        supabaseConfigured: Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me/knowledge/pages/:id', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { getPageById } = await import('../../knowledge/crawler.js');
      const page = await getPageById(req.user.websiteId, req.params.id);
      if (!page) return res.status(404).json({ message: 'الصفحة غير موجودة' });
      res.json({ page });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/me/knowledge/pages/:id', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      if (typeof req.body?.excluded_from_ai !== 'boolean') {
        return res.status(400).json({ message: 'حدد excluded_from_ai (true/false)' });
      }
      const { setPageAiVisibility } = await import('../../knowledge/crawler.js');
      const page = await setPageAiVisibility(
        req.user.websiteId,
        req.params.id,
        req.body.excluded_from_ai
      );
      if (!page) return res.status(404).json({ message: 'الصفحة غير موجودة' });
      res.json({ ok: true, page });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/me/knowledge/pages/batch-visibility', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { pageIds, excluded_from_ai } = req.body || {};
      if (!Array.isArray(pageIds) || typeof excluded_from_ai !== 'boolean') {
        return res.status(400).json({ message: 'حدد pageIds مصفوفة و excluded_from_ai (true/false)' });
      }
      if (!pageIds.length) {
        return res.json({ ok: true, count: 0, pages: [] });
      }
      const { rows } = await query(
        `UPDATE indexed_pages
            SET excluded_from_ai = $3
          WHERE website_id = $1 AND id = ANY($2::uuid[]) AND path NOT LIKE '/docs/%'
          RETURNING id, path, title, COALESCE(excluded_from_ai, false) AS excluded_from_ai`,
        [req.user.websiteId, pageIds, excluded_from_ai]
      );
      res.json({ ok: true, count: rows.length, pages: rows });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/knowledge/supabase ───────────────────────────
  router.get('/me/knowledge/supabase', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [
        req.user.websiteId,
      ]);
      const cfg = fullConfig(rows[0]?.settings || {});
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        return res.json({ configured: false, total: 0, schema: 'none', sample: [] });
      }
      const { fetchLiveDatabaseCatalog } = await import('../../knowledge/liveData.js');
      const data = await fetchLiveDatabaseCatalog(cfg, {});
      const items = data.allItems || [];
      const countBy = (type) => items.filter((i) => i.type === type).length;

      const stats =
        data.schema === 'cars'
          ? {
              cars: countBy('car'),
              banks: countBy('bank'),
              companies: countBy('company'),
              featured: countBy('featured'),
            }
          : {
              organizations: countBy('organization'),
              grades: countBy('grade'),
              topics: countBy('topic'),
              subjects: countBy('subject'),
            };

      res.json({
        configured: true,
        total: data.total || 0,
        schema: data.schema || 'unknown',
        knowledgeBaseUrl: cfg.knowledgeBaseUrl || '',
        stats,
        sample: items.slice(0, 5).map((i) => ({ title: i.title, path: i.path, type: i.type })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/knowledge/documents ─────────────────────────
  router.get('/me/knowledge/documents', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, title, source_type, status, chunk_count, error_message,
                COALESCE(excluded_from_ai, false) AS excluded_from_ai,
                created_at, updated_at, metadata
           FROM documents
          WHERE website_id = $1
          ORDER BY created_at DESC`,
        [req.user.websiteId]
      );
      res.json({ documents: rows });
    } catch (err) {
      next(err);
    }
  });

  // ─── PATCH /v1/me/knowledge/documents/:id ───────────────────
  router.patch('/me/knowledge/documents/:id', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      if (typeof req.body?.excluded_from_ai !== 'boolean') {
        return res.status(400).json({ message: 'حدد excluded_from_ai (true/false)' });
      }
      const { rows } = await query(
        `UPDATE documents
            SET excluded_from_ai = $3, updated_at = NOW()
          WHERE website_id = $1 AND id = $2
          RETURNING id, title, COALESCE(excluded_from_ai, false) AS excluded_from_ai`,
        [req.user.websiteId, req.params.id, req.body.excluded_from_ai]
      );
      if (!rows.length) return res.status(404).json({ message: 'المستند غير موجود' });
      res.json({ ok: true, document: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /v1/me/knowledge/documents/upload ─────────────────
  router.post(
    '/me/knowledge/documents/upload',
    jwtAuth,
    requireWebsite,
    (req, res, next) => {
      req.setTimeout(300000);
      res.setTimeout(300000);
      next();
    },
    knowledgeDocUpload.single('file'),
    async (req, res, next) => {
      try {
        if (!req.file?.buffer?.length) {
          return res.status(400).json({ message: 'ارفع ملف PDF أو TXT أو MD' });
        }

        await assertCanUploadDocument(
          req.user.tenantId,
          req.user.websiteId,
          req.file.buffer.length
        );

        const title = String(req.body?.title || req.file.originalname || 'مستند').trim().slice(0, 500);
        const ext = path.extname(req.file.originalname || '').toLowerCase() || '.pdf';
        const documentId = crypto.randomUUID();
        const { uploadDirFor, processUploadedDocument } = await import(
          '../../knowledge/documentProcessor.js'
        );

        const dir = uploadDirFor(req.user.tenantId, req.user.websiteId);
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${documentId}${ext}`);
        await fs.writeFile(filePath, req.file.buffer);

        await query(
          `INSERT INTO documents (id, tenant_id, website_id, title, source_type, file_path, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [documentId, req.user.tenantId, req.user.websiteId, title, ext.slice(1) || 'pdf', filePath]
        );

        const result = await processUploadedDocument({
          tenantId: req.user.tenantId,
          websiteId: req.user.websiteId,
          documentId,
          filePath,
          originalName: req.file.originalname,
          title,
        });

        const { getDocumentExtractedKnowledge } = await import('../../knowledge/documentProcessor.js');
        const extracted = await getDocumentExtractedKnowledge(req.user.websiteId, documentId);

        res.json({
          ok: true,
          documentId,
          title,
          chunkCount: result.chunkCount,
          charsExtracted: result.chars,
          extracted,
          message: `تم استخراج المعرفة وحفظ ${result.chunkCount} مقطع في قاعدة البيانات`,
        });
      } catch (err) {
        console.error('[documents/upload]', err.message);
        if (err.status === 403) {
          return res.status(403).json({ message: err.message, code: err.code });
        }
        next(err);
      }
    }
  );

  // ─── GET /v1/me/knowledge/documents/:id/extract ─────────────
  router.get('/me/knowledge/documents/:id/extract', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { getDocumentExtractedKnowledge } = await import('../../knowledge/documentProcessor.js');
      const data = await getDocumentExtractedKnowledge(req.user.websiteId, req.params.id);
      if (!data) return res.status(404).json({ message: 'المستند غير موجود' });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ─── DELETE /v1/me/knowledge/documents/:id ──────────────────
  router.delete('/me/knowledge/documents/:id', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { rows } = await query(
        `SELECT id, file_path FROM documents WHERE id = $1 AND website_id = $2`,
        [id, req.user.websiteId]
      );
      const doc = rows[0];
      if (!doc) return res.status(404).json({ message: 'المستند غير موجود' });

      const { deleteDocumentKnowledge } = await import('../../knowledge/documentProcessor.js');
      await deleteDocumentKnowledge(req.user.websiteId, id);
      await query(`DELETE FROM documents WHERE id = $1`, [id]);
      if (doc.file_path) {
        await fs.unlink(doc.file_path).catch(() => {});
      }

      res.json({ ok: true, message: 'تم حذف المستند وفهرسته' });
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /v1/me/knowledge/crawl ────────────────────────────
  // Starts a detached background crawl and returns immediately. The crawl keeps
  // running on the server even if the user closes the page; progress is polled
  // via GET /me/knowledge/crawl/status.
  router.post('/me/knowledge/crawl', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [
        req.user.websiteId,
      ]);
      const cfg = fullConfig(rows[0]?.settings || {});
      const baseUrl = (req.body?.url || cfg.knowledgeBaseUrl || '').trim();
      if (!baseUrl) {
        return res.status(400).json({ message: 'حدد رابط قاعدة المعرفة في الإعدادات أولاً' });
      }

      const depth = String(req.body?.depth || 'medium');
      const { job, alreadyRunning } = await startCrawlJob({
        websiteId: req.user.websiteId,
        tenantId: req.user.tenantId,
        baseUrl,
        depth,
      });

      return res.status(alreadyRunning ? 200 : 202).json({ job, alreadyRunning });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /v1/me/knowledge/crawl/status ──────────────────────
  // Poll current/last crawl job. `?since=<logSeq>` returns only newer log lines,
  // so the UI can reconnect after a reload and resume the live progress feed.
  router.get('/me/knowledge/crawl/status', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const since = Number.parseInt(req.query.since, 10) || 0;
      const job = await getCrawlStatus(req.user.websiteId, since);
      res.json({ job });
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /v1/me/knowledge/crawl/cancel ─────────────────────
  router.post('/me/knowledge/crawl/cancel', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const result = await cancelCrawlJob({
        websiteId: req.user.websiteId,
        jobId: req.body?.jobId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /v1/me/knowledge/test-rag ─────────────────────────
  // Simulates RAG retrieval for a question to let the user verify matched chunks & prompt context
  router.post('/me/knowledge/test-rag', jwtAuth, requireWebsite, async (req, res, next) => {
    try {
      const question = String(req.body?.question || '').trim();
      if (!question) {
        return res.status(400).json({ message: 'اكتب سؤالاً للتجربة' });
      }
      const { searchPages, buildKnowledgeContext } = await import('../../knowledge/search.js');
      const { searchDocumentChunks } = await import('../../knowledge/documentProcessor.js');
      const { rows } = await query('SELECT settings FROM websites WHERE id = $1', [req.user.websiteId]);
      const cfg = fullConfig(rows[0]?.settings || {});
      const baseUrl = cfg.knowledgeBaseUrl || '';

      const documentChunks = await searchDocumentChunks(req.user.websiteId, question, { limit: 8 });
      const kb = await searchPages({
        websiteId: req.user.websiteId,
        question,
        pageUrl: baseUrl,
        limit: 5,
        broadSearch: true,
        fullContent: true,
      });

      const promptContext = buildKnowledgeContext({
        ...kb,
        baseUrl,
        siteKnowledge: cfg.siteKnowledge,
        documentChunks,
      });

      res.json({
        question,
        pagesMatched: (kb.pages || []).map((p) => ({
          path: p.path,
          url: p.url,
          title: p.title,
          score: p.score,
          chunkCount: p.chunks?.length || 0,
          chunks: p.chunks || [],
        })),
        documentChunksMatched: (documentChunks || []).map((c) => ({
          id: c.id,
          title: c.title,
          documentTitle: c.document_title,
          kind: c.kind,
          score: c.score,
          preview: String(c.content || '').slice(0, 300),
          content: c.content,
        })),
        totalMatches: (kb.pages?.length || 0) + (documentChunks?.length || 0),
        promptPreview: promptContext.slice(0, 3500),
      });
    } catch (err) {
      next(err);
    }
  });
}
