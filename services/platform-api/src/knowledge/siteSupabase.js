/** Auto-detect public Supabase on customer sites (React/Vite SPAs) and sync full content. */

import * as cheerio from 'cheerio';
import { query } from '../db.js';

import { MAX_STORED_CONTENT_CHARS } from './knowledgeLimits.js';
import { upsertIndexedPage } from './indexedPagesStore.js';

const FETCH_TIMEOUT_MS = 15000;
const MAX_BUNDLES = 30;
const MAX_DB_CONTENT_CHARS = MAX_STORED_CONTENT_CHARS;

const TYPE_LABELS_AR = {
  article: 'مقال',
  scholarship: 'منحة دراسية',
  course: 'دورة',
  document_sample: 'نموذج مستند',
  organization: 'مؤسسة/مدرسة',
  grade: 'صف',
  subject: 'مادة',
  topic: 'موضوع',
};

function formatTextField(value, label) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v).trim()).filter(Boolean);
    if (!items.length) return '';
    return `${label}:\n${items.map((x) => `- ${x}`).join('\n')}`;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return '';
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        return formatTextField(JSON.parse(t), label);
      } catch {
        /* plain text */
      }
    }
    return `${label}:\n${t}`;
  }
  return `${label}:\n${String(value)}`;
}

function stripHtml(html) {
  if (!html) return '';
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseSupabaseCredentials(source) {
  const url =
    source.match(/["'](https:\/\/[a-z0-9-]+\.supabase\.co)["']/i)?.[1] ||
    source.match(/(https:\/\/[a-z0-9-]+\.supabase\.co)/i)?.[1];
  const key =
    source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0] ||
    source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
  if (!url || !key) return null;
  return { url, key };
}

/** Vite dev server injects import.meta.env in transformed /src/main.tsx. */
function parseViteSupabaseEnv(source) {
  const url =
    source.match(/VITE_SUPABASE_URL["']\s*:\s*["'](https:\/\/[^"']+\.supabase\.co)["']/i)?.[1] ||
    source.match(/VITE_SUPABASE_URL\s*=\s*["'](https:\/\/[^"']+\.supabase\.co)["']/i)?.[1];
  const key =
    source.match(/VITE_SUPABASE_ANON_KEY["']\s*:\s*["']([^"']+)["']/i)?.[1] ||
    source.match(/VITE_SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!url || !key) return null;
  return { url, key };
}

function collectScriptUrls(html, base) {
  const urls = new Set();
  const patterns = [
    /(?:src=["'])(\/assets\/[^"']+\.js)/gi,
    /(?:src=["'])(\/src\/[^"']+\.(?:tsx|ts|jsx|js))/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      urls.add(new URL(m[1], base).href);
    }
  }
  return urls;
}

/** Scan homepage + JS bundles for embedded Supabase URL and anon/publishable key. */
export async function extractSupabaseFromSite(baseUrl, { maxBundles = MAX_BUNDLES } = {}) {
  const base = new URL(baseUrl).origin;
  let html;
  try {
    html = await fetchText(base + '/');
  } catch {
    return null;
  }

  let creds = parseViteSupabaseEnv(html) || parseSupabaseCredentials(html);
  if (creds) return creds;

  const scriptUrls = collectScriptUrls(html, base);
  const viteEntries = [
    '/src/main.tsx',
    '/src/main.jsx',
    '/src/main.ts',
    '/src/main.js',
    '/src/App.tsx',
  ].map((p) => new URL(p, base).href);

  const toScan = [...new Set([...viteEntries, ...scriptUrls])];
  let fetched = 0;
  for (const scriptUrl of toScan) {
    if (fetched >= maxBundles) break;
    fetched += 1;
    try {
      const js = await fetchText(scriptUrl);
      creds = parseViteSupabaseEnv(js) || parseSupabaseCredentials(js);
      if (creds) return creds;
    } catch {
      /* skip */
    }
  }

  return null;
}

async function supabaseGet(supabaseUrl, key, path) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`${res.status} ${err.slice(0, 80)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseFetchAll(supabaseUrl, key, tableQuery, { pageSize = 1000, maxRows = 50000 } = {}) {
  const all = [];
  const [table, rawQs = ''] = tableQuery.split('?');
  const params = new URLSearchParams(rawQs);
  params.delete('limit');
  params.delete('offset');
  const qs = params.toString();

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const path = `${table}?${qs}${qs ? '&' : ''}limit=${pageSize}&offset=${offset}`;
    const data = await supabaseGet(supabaseUrl, key, path);
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

async function detectSiteSchema(supabaseUrl, key) {
  try {
    await supabaseGet(supabaseUrl, key, 'organizations?select=id&limit=1');
    return 'education';
  } catch {
    /* not education */
  }
  try {
    await supabaseGet(supabaseUrl, key, 'articles?select=id&limit=1');
    return 'scholarium';
  } catch {
    /* not scholarium */
  }
  return 'unknown';
}

function mapArticle(row) {
  if (!row?.title || !row?.slug) return null;
  const body = stripHtml(row.content_html) || row.excerpt || row.seo_description || '';
  const parts = [
    row.excerpt && row.excerpt !== body ? formatTextField(row.excerpt, 'المقتطف') : '',
    body ? formatTextField(body, 'المحتوى') : '',
    row.seo_description ? formatTextField(row.seo_description, 'SEO') : '',
  ].filter(Boolean);
  return {
    id: row.id,
    type: 'article',
    title: row.title,
    path: `/maqalat/${row.slug}`,
    description: parts.join('\n\n').slice(0, MAX_DB_CONTENT_CHARS),
  };
}

function mapScholarship(row) {
  if (!row?.title || !row?.id) return null;
  const parts = [
    row.description,
    formatTextField(row.requirements, 'المتطلبات'),
    formatTextField(row.benefits, 'المزايا'),
    row.country && `الدولة: ${row.country}`,
    row.deadline && `آخر موعد: ${row.deadline}`,
    row.degree_level && `المرحلة: ${row.degree_level}`,
    row.field_of_study && `التخصص: ${row.field_of_study}`,
    row.university && `الجامعة: ${row.university}`,
    row.link && `الرابط: ${row.link}`,
  ].filter(Boolean);
  return {
    id: row.id,
    type: 'scholarship',
    title: row.title,
    path: `/scholarships/${row.id}`,
    description: parts.join('\n\n').slice(0, MAX_DB_CONTENT_CHARS),
  };
}

function mapCourse(row) {
  if (!row?.title || !row?.id) return null;
  const parts = [
    row.description,
    row.source_url && `مصدر الدورة: ${row.source_url}`,
    row.source_type && `نوع المصدر: ${row.source_type}`,
    row.recommender_name && `الموصي: ${row.recommender_name}`,
  ].filter(Boolean);
  return {
    id: row.id,
    type: 'course',
    title: row.title,
    path: `/courses/${row.id}`,
    description: parts.join('\n\n').slice(0, MAX_DB_CONTENT_CHARS),
  };
}

function mapDocumentSample(row) {
  if (!row?.title || !row?.id) return null;
  const parts = [
    row.description,
    row.file_url && `ملف: ${row.file_url}`,
  ].filter(Boolean);
  return {
    id: row.id,
    type: 'document_sample',
    title: row.title,
    path: `/document-samples/${row.id}`,
    description: parts.join('\n\n').slice(0, MAX_DB_CONTENT_CHARS),
  };
}

const SCHOLARIUM_TABLES = [
  {
    name: 'articles',
    query: 'articles?select=id,title,slug,excerpt,content_html,seo_description,status&status=eq.published&order=published_at.desc',
    map: mapArticle,
  },
  {
    name: 'scholarships',
    query:
      'scholarships?select=id,title,description,country,deadline,degree_level,field_of_study,requirements,benefits,university,link,is_published&is_published=eq.true&order=created_at.desc',
    map: mapScholarship,
  },
  {
    name: 'courses',
    query:
      'courses?select=id,title,description,source_url,source_type,recommender_name,is_active&is_active=eq.true&order=created_at.desc',
    map: mapCourse,
  },
  {
    name: 'document_samples',
    query: 'document_samples?select=id,title,description,file_url,is_active&is_active=eq.true&order=order.asc',
    map: mapDocumentSample,
  },
];

export async function fetchScholariumSiteCatalog(supabaseUrl, key, { unlimited = true } = {}) {
  const items = [];
  const stats = {};

  for (const t of SCHOLARIUM_TABLES) {
    try {
      const rows = unlimited
        ? await supabaseFetchAll(supabaseUrl, key, t.query)
        : await supabaseGet(supabaseUrl, key, `${t.query}&limit=200`);
      let n = 0;
      for (const row of rows) {
        const item = t.map(row);
        if (item) {
          items.push(item);
          n += 1;
        }
      }
      stats[t.name] = n;
    } catch (err) {
      console.warn(`[siteSupabase] ${t.name} skipped:`, err.message);
      stats[t.name] = 0;
    }
  }

  return { items, stats, schema: 'scholarium' };
}

export async function fetchEducationSiteCatalog(supabaseUrl, key, { unlimited = true } = {}) {
  const items = [];
  const stats = {};

  try {
    const orgs = unlimited
      ? await supabaseFetchAll(
          supabaseUrl,
          key,
          'organizations?select=id,name,slug,description,entity_type&order=name.asc'
        )
      : await supabaseGet(supabaseUrl, key, 'organizations?select=id,name,slug,description,entity_type&order=name.asc&limit=100');
    for (const row of orgs) {
      if (!row?.slug || !row?.name) continue;
      items.push({
        id: row.id,
        type: 'organization',
        title: row.name,
        path: `/org/${row.slug}`,
        description: row.description || '',
      });
    }
    stats.organizations = orgs.length;
  } catch (err) {
    console.warn('[siteSupabase] organizations skipped:', err.message);
    stats.organizations = 0;
  }

  const gradeSlugById = new Map();
  const gradeNameById = new Map();
  try {
    const grades = unlimited
      ? await supabaseFetchAll(
          supabaseUrl,
          key,
          'grades?select=id,name,slug,description,is_active,is_hidden&is_active=eq.true&is_hidden=eq.false&order=sort_order.asc'
        )
      : await supabaseGet(
          supabaseUrl,
          key,
          'grades?select=id,name,slug,description,is_active,is_hidden&is_active=eq.true&is_hidden=eq.false&order=sort_order.asc&limit=200'
        );
    for (const row of grades) {
      if (!row?.slug || !row?.name) continue;
      gradeSlugById.set(row.id, row.slug);
      gradeNameById.set(row.id, row.name);
      items.push({
        id: row.id,
        type: 'grade',
        title: row.name,
        path: `/grade/${row.slug}`,
        description: row.description || '',
      });
    }
    stats.grades = grades.length;
  } catch (err) {
    console.warn('[siteSupabase] grades skipped:', err.message);
    stats.grades = 0;
  }

  try {
    const subjects = unlimited
      ? await supabaseFetchAll(
          supabaseUrl,
          key,
          'subjects?select=id,name,description,grade_id,is_active&is_active=eq.true&order=sort_order.asc'
        )
      : await supabaseGet(
          supabaseUrl,
          key,
          'subjects?select=id,name,description,grade_id,is_active&is_active=eq.true&order=sort_order.asc&limit=300'
        );
    let n = 0;
    for (const row of subjects) {
      const gradeSlug = gradeSlugById.get(row.grade_id);
      if (!row?.name || !gradeSlug) continue;
      items.push({
        id: row.id,
        type: 'subject',
        title: row.name,
        path: `/grade/${gradeSlug}/subject/${row.id}`,
        description: row.description || '',
        grade: gradeNameById.get(row.grade_id) || '',
      });
      n += 1;
    }
    stats.subjects = n;
  } catch (err) {
    console.warn('[siteSupabase] subjects skipped:', err.message);
    stats.subjects = 0;
  }

  try {
    const topicQuery =
      'topics?select=id,title,description,subject_id,subjects(id,name,grade_id,grades(slug,name)),is_active&is_active=eq.true&order=sort_order.asc';
    const topics = unlimited
      ? await supabaseFetchAll(supabaseUrl, key, topicQuery)
      : await supabaseGet(supabaseUrl, key, `${topicQuery}&limit=500`);
    let n = 0;
    for (const row of topics) {
      const sub = row.subjects;
      const gradeSlug = sub?.grades?.slug;
      const subjectId = sub?.id || row.subject_id;
      if (!row?.title || !gradeSlug || !subjectId) continue;
      const parts = [
        row.description,
        sub?.name && `المادة: ${sub.name}`,
        sub?.grades?.name && `الصف: ${sub.grades.name}`,
      ].filter(Boolean);
      items.push({
        id: row.id,
        type: 'topic',
        title: row.title,
        path: `/grade/${gradeSlug}/subject/${subjectId}/topic/${row.id}`,
        description: parts.join('\n\n'),
        subject: sub?.name || '',
        grade: sub?.grades?.name || '',
      });
      n += 1;
    }
    stats.topics = n;
  } catch (err) {
    console.warn('[siteSupabase] topics skipped:', err.message);
    stats.topics = 0;
  }

  return { items, stats, schema: 'education' };
}

export async function fetchSiteCatalog(supabaseUrl, key, { unlimited = true } = {}) {
  const schema = await detectSiteSchema(supabaseUrl, key);
  if (schema === 'education') {
    return fetchEducationSiteCatalog(supabaseUrl, key, { unlimited });
  }
  if (schema === 'scholarium') {
    return fetchScholariumSiteCatalog(supabaseUrl, key, { unlimited });
  }
  const scholarium = await fetchScholariumSiteCatalog(supabaseUrl, key, { unlimited });
  if (scholarium.items.length) return scholarium;
  return fetchEducationSiteCatalog(supabaseUrl, key, { unlimited });
}

/** Paths from site-embedded Supabase (for crawl seeding). */
export async function discoverSiteSupabasePaths(baseUrl, { unlimited = false } = {}) {
  const creds = await extractSupabaseFromSite(baseUrl);
  if (!creds) return [];
  const { items } = await fetchSiteCatalog(creds.url, creds.key, { unlimited });
  return items.map((i) => i.path).filter(Boolean);
}

function pageFromItem(item, baseUrl) {
  const base = new URL(baseUrl).origin;
  const url = `${base}${item.path}`;
  const typeLabel = TYPE_LABELS_AR[item.type] || item.type || 'محتوى';
  const lines = [
    `[محتوى من Supabase — ${typeLabel}]`,
    `المسار: ${item.path}`,
    `العنوان: ${item.title}`,
  ];
  if (item.grade) lines.push(`الصف: ${item.grade}`);
  if (item.subject) lines.push(`المادة: ${item.subject}`);
  if (item.description) lines.push('', item.description);
  return {
    path: item.path,
    url,
    title: item.title,
    content: lines.join('\n').slice(0, MAX_DB_CONTENT_CHARS),
    headings: [],
  };
}

const SCHEMA_LABELS = {
  education: 'مدارس وصفوف ومواد ومواضيع',
  scholarium: 'مقالات ومنح ودورات',
};

/** Detect site Supabase + sync public catalog into indexed_pages. */
export async function syncDiscoveredSiteDatabase({
  baseUrl,
  tenantId,
  websiteId,
  onProgress,
  unlimited = true,
}) {
  onProgress?.({ phase: 'db', text: 'البحث عن Supabase مدمج في الموقع…' });

  const creds = await extractSupabaseFromSite(baseUrl);
  if (!creds) {
    return { synced: 0, schema: 'none', message: 'لم يُعثر على Supabase في الموقع' };
  }

  const schemaHint = await detectSiteSchema(creds.url, creds.key);
  const label = SCHEMA_LABELS[schemaHint] || 'محتوى عام';

  onProgress?.({
    phase: 'db',
    text: `Supabase مكتشف — جلب ${label}…`,
    meta: { url: creds.url, schema: schemaHint },
  });

  const { items, stats, schema } = await fetchSiteCatalog(creds.url, creds.key, { unlimited });
  if (!items.length) {
    return { synced: 0, schema, message: 'Supabase موجود لكن لا سجلات عامة' };
  }

  const byPath = new Map();
  for (const item of items) {
    const page = pageFromItem(item, baseUrl);
    byPath.set(page.path, page);
  }

  const pages = [...byPath.values()];
  let synced = 0;
  for (const page of pages) {
    synced += 1;
    onProgress?.({
      phase: 'db',
      text: `فهرسة ${synced}/${pages.length} ${page.path} — ${page.content.length.toLocaleString('ar-SA')} حرف`,
      meta: { path: page.path, chars: page.content.length, progress: synced, total: pages.length },
    });
    await upsertIndexedPage(query, {
      tenantId,
      websiteId,
      url: page.url,
      path: page.path,
      title: page.title,
      content: page.content,
      headings: page.headings,
    });
  }

  const summary = Object.entries(stats)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join('، ');

  onProgress?.({
    phase: 'db',
    text: `مزامنة Supabase من الموقع — ${synced} سجل (${summary})`,
    meta: { synced, stats, schema },
  });

  console.log(`[siteSupabase] synced ${synced} records (${schema}) for ${websiteId}: ${summary}`);

  return { synced, schema, stats, items, message: `تم فهرسة ${synced} سجل من Supabase الموقع` };
}
