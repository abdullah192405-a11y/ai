// Answer "which grades/classes have topics about X?" — group by grade, not raw page dump.

function decodePath(path) {
  if (!path) return '';
  try {
    return decodeURIComponent(String(path));
  } catch {
    return String(path);
  }
}

function normalizeArabic(w) {
  return String(w || '')
    .toLowerCase()
    .replace(/^ال/, '')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

export function isExplicitSearchQuestion(question) {
  return /(?:ابحث|بحث|find|search)\s+(?:عن|about|for)/iu.test(String(question || ''));
}

export function isGradesByTopicQuestion(question) {
  const q = String(question || '');
  return (
    /(?:فصول|فصل|صفوف|صف|مراحل|grades?|classes?)/iu.test(q) &&
    /(?:موضوع|مواضيع|topics?)/iu.test(q) &&
    /(?:في|عن|about|يتعلق|ذكاء|محتو|ماده|subject|حول)/iu.test(q)
  );
}

export function matchesTopicFocus(text, question) {
  const blob = normalizeArabic(String(text || ''));
  const q = String(question || '');

  if (/ذكاء\s*اصطناع|الذكاء\s*الاصطناع|\bai\b|artificial\s*intelligence/iu.test(q)) {
    if (/ذكاء\s*اصطناع|الذكاء\s*الاصطناع|\bai\b|artificial\s*intelligence/iu.test(text)) {
      return true;
    }
    if (/بذكاء|بذك/u.test(blob) && !/اصطناع|\bai\b|artificial/iu.test(text)) {
      return false;
    }
    return false;
  }

  const focus = topicLabelFromQuestion(question);
  if (!focus) return false;
  return blob.includes(normalizeArabic(focus));
}

function topicLabelFromQuestion(question) {
  const q = String(question || '');
  const m = q.match(/(?:في|عن|about|حول)\s+(.+?)(?:[؟?]|$)/iu);
  if (m?.[1]) return m[1].trim();
  if (/ذكاء\s*اصطناع|الذكاء\s*الاصطناع/iu.test(q)) return 'الذكاء الاصطناعي';
  return '';
}

function buildGradeNameMap(indexedPages = []) {
  const map = new Map();
  for (const p of indexedPages) {
    const m = String(p.path || '').match(/^\/grade\/([^/]+)$/);
    if (m) map.set(m[1], String(p.title || '').trim() || decodePath(m[1]));
  }
  return map;
}

function gradeFromPath(path, gradeNames) {
  const m = String(path || '').match(/^\/grade\/([^/]+)/);
  if (!m) return null;
  const slug = m[1];
  return {
    slug,
    path: `/grade/${slug}`,
    label: gradeNames.get(slug) || decodePath(slug).replace(/-/g, ' '),
  };
}

function isEducationalTopicRow(row) {
  const path = String(row.path || '');
  if (!path.startsWith('/grade/')) return false;
  return /\/topic\/|\/subject\//.test(path);
}

function collectTopicRows({ catalogItems = [], indexedPages = [] }) {
  const rows = [];
  const seen = new Set();

  const add = (row) => {
    const path = String(row.path || '').split('?')[0];
    const title = String(row.title || '').trim();
    if (!path || !title || seen.has(`${path}|${title}`)) return;
    seen.add(`${path}|${title}`);
    rows.push({ ...row, path, title });
  };

  for (const item of catalogItems) {
    if (item.type === 'topic' || item.type === 'subject' || isEducationalTopicRow(item)) {
      add(item);
    }
  }

  for (const p of indexedPages) {
    if (isEducationalTopicRow(p)) {
      add({ title: p.title, path: p.path, grade: p.grade, type: 'page' });
    }
  }

  return rows;
}

/** Deterministic answer: list grades that contain topics matching the subject. */
export function composeGradesByTopicAnswer({ question, catalogItems = [], indexedPages = [] }) {
  if (!isGradesByTopicQuestion(question)) return null;

  const topicLabel = topicLabelFromQuestion(question) || 'الموضوع المطلوب';
  const gradeNames = buildGradeNameMap(indexedPages);
  const rows = collectTopicRows({ catalogItems, indexedPages }).filter((row) =>
    matchesTopicFocus(`${row.title} ${row.description || ''} ${row.subject || ''}`, question)
  );

  const byGrade = new Map();
  for (const row of rows) {
    const grade = row.grade
      ? { path: gradeFromPath(row.path, gradeNames)?.path, label: row.grade }
      : gradeFromPath(row.path, gradeNames);
    if (!grade?.path) continue;

    if (!byGrade.has(grade.path)) {
      byGrade.set(grade.path, { path: grade.path, label: grade.label, topics: [] });
    }
    const entry = byGrade.get(grade.path);
    if (!entry.topics.includes(row.title)) entry.topics.push(row.title);
  }

  const grades = [...byGrade.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'ar')
  );

  if (!grades.length) {
    return {
      text:
        `لم أجد فصولاً تحتوي مواضيع واضحة عن «${topicLabel}» في الفهرس.\n\n` +
        'جرّب صياغة أدق، مثل: «ابحث عن موضوع الذكاء الاصطناعي».',
      navigateTargets: [],
    };
  }

  const lines = [
    `الفصول التي تضم مواضيع عن «${topicLabel}» (${grades.length}):`,
    '',
  ];

  for (const g of grades) {
    const sample = g.topics.slice(0, 2).join('، ');
    lines.push(`• **${g.label}**${sample ? ` — مثل: ${sample}` : ''}`);
  }

  lines.push('', 'اضغط زر الفصل الذي تريد فتحه.');

  return {
    text: lines.join('\n'),
    navigateTargets: grades.slice(0, 6).map((g) => ({
      path: g.path,
      label: g.label,
    })),
  };
}
