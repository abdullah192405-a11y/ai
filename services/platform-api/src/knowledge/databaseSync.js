// Sync public Supabase content into indexed_pages during crawl (no user/private data).

import { query } from '../db.js';
import { upsertIndexedPage } from './indexedPagesStore.js';

/** Types safe to index — never users, profiles, sessions, or auth data. */
const PUBLIC_CONTENT_TYPES = new Set([
  'organization',
  'grade',
  'topic',
  'subject',
  'course',
  'challenge',
  'car',
  'bank',
  'company',
  'featured',
  'article',
  'item',
]);

const TYPE_LABELS = {
  organization: 'مؤسسة/مدرسة',
  grade: 'صف',
  topic: 'موضوع',
  subject: 'مادة',
  course: 'دورة',
  challenge: 'تحدي',
  car: 'سيارة',
  bank: 'بنك',
  company: 'شركة',
  featured: 'موديل مميز',
  article: 'مقال',
  item: 'محتوى',
};

function normalizeBaseUrl(raw) {
  const u = new URL(raw);
  return `${u.protocol}//${u.host}`;
}

function indexedPathForItem(item) {
  const id = item.id ? String(item.id) : '';
  const basePath = item.path && String(item.path).startsWith('/') ? item.path.split('?')[0] : '';

  // Prefer real site routes when they are unique (car detail, org, grade).
  if (basePath && basePath !== '/' && !['/banks', '/companies', '/articles', '/featured-models', '/reviews'].includes(basePath)) {
    if (basePath.includes('/', 1) || !id) return basePath;
  }

  if (id) return `/db/${item.type || 'item'}/${id}`;

  const slug = item.title?.slice(0, 48)?.replace(/\s+/g, '-');
  return `/db/${item.type || 'item'}/${slug || 'unknown'}`;
}

function pageFromCatalogItem(item, baseUrl) {
  const path = indexedPathForItem(item);
  const typeLabel = TYPE_LABELS[item.type] || item.type || 'محتوى';
  const lines = [
    `[محتوى عام من قاعدة البيانات — ${typeLabel}]`,
    `العنوان: ${item.title}`,
  ];
  if (item.subject) lines.push(`التصنيف: ${item.subject}`);
  if (item.grade) lines.push(`الصف/النوع: ${item.grade}`);
  if (item.description) lines.push(`التفاصيل: ${String(item.description)}`);
  if (item.path && item.path !== path) lines.push(`مسار التنقل في الموقع: ${item.path}`);

  let url;
  try {
    url = new URL(item.path && item.path.startsWith('/') ? item.path : path, baseUrl).href;
  } catch {
    url = `${normalizeBaseUrl(baseUrl)}${path}`;
  }

  return {
    path,
    url,
    title: `[${typeLabel}] ${item.title}`,
    content: lines.join('\n'),
    headings: [],
  };
}

const DB_KNOWLEDGE_MARKER = '--- محتوى قاعدة البيانات';

/** Remove stale Supabase block when the site has no database configured. */
export function stripDatabaseKnowledgeBlock(text = '') {
  const t = String(text || '').trim();
  const idx = t.indexOf(DB_KNOWLEDGE_MARKER);
  if (idx < 0) return t;
  return t.slice(0, idx).trimEnd();
}

export function buildSiteKnowledgeFromDatabase(items, existingText = '', schema = '') {
  const publicItems = items.filter((i) => PUBLIC_CONTENT_TYPES.has(i.type));
  const text = stripDatabaseKnowledgeBlock(existingText);
  if (!publicItems.length) return text;

  const header = '--- محتوى قاعدة البيانات (محتوى عام — بدون بيانات مستخدمين) ---';
  const intro =
    schema === 'cars'
      ? 'سيارات، بنوك، شركات، ومقالات متاحة للزوار:'
      : schema === 'education'
        ? 'مدارس، صفوف، مواد، ومواضيع تعليمية:'
        : 'سجلات المحتوى العام:';

  const byType = new Map();
  for (const item of publicItems) {
    const key = item.type || 'item';
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(item);
  }

  const lines = [header, intro, ''];
  for (const [type, group] of byType) {
    const label = TYPE_LABELS[type] || type;
    lines.push(`${label} (${group.length}):`);
    for (const item of group) {
      const extra = [item.subject, item.grade].filter(Boolean).join(' · ');
      const desc = String(item.description || '').trim();
      lines.push(`- ${item.title}${extra ? ` (${extra})` : ''}${item.path ? ` → ${item.path}` : ''}`);
      if (desc) lines.push(`  ${desc}`);
    }
    lines.push('');
  }

  const block = lines.join('\n').trim();
  const marker = DB_KNOWLEDGE_MARKER;

  if (!text) return block;
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    const before = text.slice(0, idx).trimEnd();
    return before ? `${before}\n\n${block}` : block;
  }
  return `${text}\n\n${block}`;
}

export async function syncDatabaseContentToIndex({ config, tenantId, websiteId, baseUrl, fullSync = true, unlimited = false }) {
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    return { synced: 0, schema: 'none', message: 'Supabase غير مضبوط' };
  }

  const { fetchLiveDatabaseCatalog } = await import('./liveData.js');
  const data = await fetchLiveDatabaseCatalog(config, { fullSync, unlimited });
  const items = (data.allItems || []).filter((i) => PUBLIC_CONTENT_TYPES.has(i.type));

  const base = normalizeBaseUrl(baseUrl);
  const byPath = new Map();

  for (const item of items) {
    const page = pageFromCatalogItem(item, base);
    if (!byPath.has(page.path)) byPath.set(page.path, page);
  }

  let synced = 0;
  for (const page of byPath.values()) {
    await upsertIndexedPage(query, {
      tenantId,
      websiteId,
      url: page.url,
      path: page.path,
      title: page.title,
      content: page.content,
      headings: page.headings,
    });
    synced++;
  }

  console.log(`[databaseSync] indexed ${synced} public records (${data.schema}) for website ${websiteId}`);

  return {
    synced,
    schema: data.schema || 'unknown',
    total: data.total || 0,
    message: synced
      ? `تم فهرسة ${synced} سجل محتوى من Supabase`
      : 'لا توجد سجلات محتوى عام في Supabase',
  };
}
