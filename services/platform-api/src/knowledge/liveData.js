import { extractItemsFromPayload, dedupeItems } from './catalog.js';
import { searchTerms, matchesTerms } from './contentSearch.js';
import { CAR_SUPABASE_QUERIES } from './carCatalog.js';

const cache = new Map();
const schemaCache = new Map();
const CACHE_MS = 3 * 60 * 1000;

function cacheKey(config) {
  return `${config.supabaseUrl || ''}|${config.supabaseAnonKey?.slice(0, 12) || ''}`;
}

function supabaseHeaders(anonKey) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
  };
}

async function supabaseGet(baseUrl, anonKey, path) {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/v1/${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: supabaseHeaders(anonKey), signal: ctrl.signal });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status}: ${err.slice(0, 120)}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function detectSupabaseSchema(supabaseUrl, supabaseAnonKey) {
  const key = cacheKey({ supabaseUrl, supabaseAnonKey });
  const cached = schemaCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.schema;

  let schema = 'education';
  try {
    await supabaseGet(supabaseUrl, supabaseAnonKey, 'Car?select=id&limit=1');
    schema = 'cars';
  } catch {
    /* fall back to education tables */
  }

  schemaCache.set(key, { schema, at: Date.now() });
  return schema;
}

function filterByQuestion(items, question) {
  const terms = searchTerms(question);
  if (!terms.length) return items;
  return items.filter((item) => {
    const blob = `${item.title} ${item.description} ${item.subject} ${item.grade} ${item.path}`;
    return matchesTerms(blob, terms);
  });
}

async function supabaseFetchAll(supabaseUrl, supabaseAnonKey, tableQuery, { pageSize = 1000, maxRows = 50000 } = {}) {
  const all = [];
  const [table, rawQs = ''] = tableQuery.split('?');
  const params = new URLSearchParams(rawQs);
  params.delete('limit');
  params.delete('offset');
  const qs = params.toString();

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const path = `${table}?${qs}${qs ? '&' : ''}limit=${pageSize}&offset=${offset}`;
    const data = await supabaseGet(supabaseUrl, supabaseAnonKey, path);
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

async function fetchCarSupabaseCatalog(config, { limit = 150, fullSync = false, unlimited = false } = {}) {
  const { supabaseUrl, supabaseAnonKey } = config;
  const allItems = [];
  const carLimit = unlimited ? 50000 : fullSync ? 300 : Math.max(limit, 150);

  for (const q of CAR_SUPABASE_QUERIES) {
    if ((fullSync || unlimited) && q.path.startsWith('Review')) continue;
    try {
      let data;
      if (unlimited) {
        const basePath = q.path.replace(/&?limit=\d+/g, '');
        data = await supabaseFetchAll(supabaseUrl, supabaseAnonKey, basePath);
      } else {
        const path = q.path.includes('limit=')
          ? q.path.replace(/limit=\d+/, `limit=${carLimit}`)
          : q.path;
        data = await supabaseGet(supabaseUrl, supabaseAnonKey, path);
      }
      if (!Array.isArray(data)) continue;
      for (const row of data) {
        const item = q.map(row);
        if (item) allItems.push(item);
      }
    } catch (err) {
      console.warn('[liveData] car supabase query failed:', q.path.split('?')[0], err.message?.slice(0, 100));
    }
  }

  return dedupeItems(allItems);
}

async function fetchEducationSupabaseCatalog(config, { limit = 120, fullSync = false, unlimited = false } = {}) {
  const { supabaseUrl, supabaseAnonKey } = config;
  const allItems = [];
  const topicLimit = unlimited ? 50000 : fullSync ? 500 : limit;
  const orgLimit = unlimited ? 50000 : fullSync ? 200 : 50;
  const gradeLimit = unlimited ? 50000 : fullSync ? 200 : 80;
  const subjectLimit = unlimited ? 50000 : fullSync ? 200 : 50;

  const queries = [
    { table: `organizations?select=id,name,slug,description,entity_type&order=name.asc`, limit: orgLimit },
    { table: `grades?select=id,name,slug,description,organization_id,organizations(name,slug)&order=name.asc`, limit: gradeLimit },
    { table: `topics?select=id,title,description&order=title.asc`, limit: topicLimit },
    { table: `subjects?select=id,name,description&order=name.asc`, limit: subjectLimit },
  ];

  for (const q of queries) {
    try {
      let data;
      if (unlimited) {
        data = await supabaseFetchAll(supabaseUrl, supabaseAnonKey, q.table);
      } else {
        data = await supabaseGet(supabaseUrl, supabaseAnonKey, `${q.table}&limit=${q.limit}`);
      }
      if (data) allItems.push(...extractItemsFromPayload(data, q.table, 'supabase'));
    } catch (err) {
      console.warn('[liveData] supabase query failed:', q.table.split('?')[0], err.message?.slice(0, 100));
    }
  }

  return dedupeItems(allItems);
}

export async function fetchSupabaseCatalog(config, { question, limit = 120, fullSync = false, unlimited = false } = {}) {
  const { supabaseUrl, supabaseAnonKey } = config || {};
  if (!supabaseUrl || !supabaseAnonKey) return { items: [], source: 'supabase', schema: 'none' };

  const key = `${cacheKey(config)}|${unlimited ? 'all' : fullSync ? 'full' : 'partial'}`;
  const cached = unlimited ? null : cache.get(key);
  let allItems;
  let schema;

  if (cached && Date.now() - cached.at < CACHE_MS) {
    allItems = cached.items;
    schema = cached.schema;
  } else {
    schema = await detectSupabaseSchema(supabaseUrl, supabaseAnonKey);
    allItems =
      schema === 'cars'
        ? await fetchCarSupabaseCatalog(config, { limit: Math.max(limit, 150), fullSync, unlimited })
        : await fetchEducationSupabaseCatalog(config, { limit, fullSync, unlimited });

    if (!unlimited) cache.set(key, { items: allItems, schema, at: Date.now() });
    console.log(`[liveData] loaded ${allItems.length} records from Supabase (${schema}${unlimited ? ', unlimited' : ''})`);
  }

  const relevant = question ? filterByQuestion(allItems, question) : allItems;
  return {
    items: relevant.length ? relevant : allItems.slice(0, 30),
    total: allItems.length,
    allItems,
    source: 'supabase',
    schema,
  };
}

export async function fetchLiveDatabaseCatalog(config, { question, fullSync = false, unlimited = false } = {}) {
  if (config?.supabaseUrl && config?.supabaseAnonKey) {
    return fetchSupabaseCatalog(config, { question, fullSync, unlimited });
  }
  return { items: [], total: 0, allItems: [], source: 'none', schema: 'none' };
}
