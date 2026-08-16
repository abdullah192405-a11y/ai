// Normalize API / Supabase JSON into a flat catalog for the chatbot.

const TITLE_KEYS = ['title', 'name', 'label', 'courseName', 'challengeName', 'topic_title'];
const DESC_KEYS = ['description', 'summary', 'subtitle', 'content', 'body'];

function pickField(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function recordTypeFromUrl(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('topic')) return 'topic';
  if (u.includes('subject')) return 'subject';
  if (u.includes('grade')) return 'grade';
  if (u.includes('challenge')) return 'challenge';
  if (u.includes('course')) return 'course';
  if (u.includes('organization')) return 'organization';
  return 'item';
}

function pushItem(items, raw, url, extra = {}) {
  if (!raw || typeof raw !== 'object') return;
  const title = pickField(raw, TITLE_KEYS);
  if (!title) return;
  const description = pickField(raw, DESC_KEYS);
  const id = raw.id || raw.slug || raw.uuid;
  let subject = extra.subject || '';
  let grade = extra.grade || '';
  const type = extra.type || recordTypeFromUrl(url);
  let path = raw.path || raw.url || '';
  if (!path && raw.slug) {
    if (type === 'organization') path = `/org/${raw.slug}`;
    else if (type === 'grade') path = `/grade/${raw.slug}`;
    else path = String(raw.slug);
  } else if (path && !String(path).startsWith('/') && type === 'organization') {
    path = `/org/${path}`;
  } else if (path && !String(path).startsWith('/') && type === 'grade') {
    path = `/grade/${path}`;
  } else if (path) {
    path = String(path);
  }
  if (raw.subjects && typeof raw.subjects === 'object' && !Array.isArray(raw.subjects)) {
    subject = subject || pickField(raw.subjects, TITLE_KEYS);
  }
  if (raw.grades && typeof raw.grades === 'object' && !Array.isArray(raw.grades)) {
    grade = grade || pickField(raw.grades, TITLE_KEYS);
  }
  if (raw.organizations && typeof raw.organizations === 'object' && !Array.isArray(raw.organizations)) {
    grade = grade || pickField(raw.organizations, TITLE_KEYS);
  }
  items.push({
    id: id ? String(id) : undefined,
    title,
    description,
    path,
    type,
    subject: subject || raw.subject_name || '',
    grade: grade || raw.grade_name || '',
    source: extra.source || 'api',
  });
}

function walkNode(node, url, items, ctx = {}) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const child of node) walkNode(child, url, items, ctx);
    return;
  }
  if (typeof node !== 'object') return;

  pushItem(items, node, url, ctx);

  const nestedKeys = [
    'topics', 'subjects', 'grades', 'organizations', 'courses', 'challenges',
    'content', 'items', 'results', 'data', 'records', 'rows',
  ];

  for (const key of nestedKeys) {
    if (!node[key]) continue;
    const childCtx = { ...ctx };
    if (key === 'subjects') childCtx.subject = pickField(node, TITLE_KEYS);
    if (key === 'grades') childCtx.grade = pickField(node, TITLE_KEYS);
    if (key === 'organizations') childCtx.type = 'organization';
    walkNode(node[key], url, items, childCtx);
  }
}

export function extractItemsFromPayload(data, url, source = 'api') {
  const items = [];
  walkNode(data, url, items, { source });
  return dedupeItems(items);
}

export function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.title}|${item.id || ''}|${item.path || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeCatalogs(...catalogs) {
  const all = [];
  for (const cat of catalogs) {
    if (!cat) continue;
    if (Array.isArray(cat)) {
      all.push(...cat);
      continue;
    }
    if (Array.isArray(cat.items)) {
      all.push(...cat.items);
      continue;
    }
    all.push(...itemsFromCatalog(cat));
  }
  return dedupeItems(all);
}

export function itemsFromCatalog(catalog) {
  if (!catalog) return [];
  if (Array.isArray(catalog)) return dedupeItems(catalog);

  const items = [];
  const lists = [
    catalog.topics,
    catalog.courses,
    catalog.challenges,
    catalog.content,
    catalog.subjects,
    catalog.grades,
    catalog.items,
    catalog.records,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      pushItem(items, raw, '', { source: catalog.source || 'client' });
    }
  }
  return dedupeItems(items);
}

export function formatCatalogForPrompt(items, { question, maxItems = 40 } = {}) {
  if (!items?.length) {
    return '--- بيانات قاعدة البيانات / API ---\nلا توجد بيانات ملتقطة بعد. اطلب من المستخدم تصفح الموقع أو انتظر تحميل الصفحة.';
  }

  const isCars = items.some((i) => i.type === 'car');
  const lines = [
    isCars
      ? '--- بيانات Supabase (سيارات، بنوك، شركات) ---'
      : '--- بيانات قاعدة البيانات / API (دورات، مواضيع، محتوى) ---',
    `عدد السجلات المتاحة: ${items.length}`,
    isCars
      ? 'استخدم هذه القائمة للإجابة عن أسئلة السيارات والأسعار والتمويل والبنوك.'
      : 'استخدم هذه القائمة للإجابة عن أسئلة البحث والدورات والمحتوى.',
    '',
  ];

  const slice = items.slice(0, maxItems);
  for (const item of slice) {
    const parts = [`- ${item.title}`];
    if (item.subject) parts.push(`مادة: ${item.subject}`);
    if (item.grade) parts.push(`صف: ${item.grade}`);
    if (item.description) parts.push(item.description.slice(0, 100));
    if (item.path) parts.push(`(${item.path})`);
    lines.push(parts.join(' — '));
  }

  if (items.length > maxItems) {
    lines.push(`… و${items.length - maxItems} سجل إضافي`);
  }

  if (question) {
    lines.push('', `سؤال المستخدم: ${question}`);
  }

  return lines.join('\n');
}

// Re-export for contentSearch compatibility
export { itemsFromCatalog as catalogToItems };
