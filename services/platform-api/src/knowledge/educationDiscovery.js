// Generic "where do I find educational content?" — list /grades + top channels, not keyword noise.

import { isGradesByTopicQuestion } from './gradesByTopic.js';

function normalizeArabic(w) {
  return String(w || '')
    .toLowerCase()
    .replace(/^ال/, '')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/** "أين أجد المحتوى التعليمي؟" — not a specific school/topic search. */
export function isEducationalDiscoveryQuestion(question) {
  const q = String(question || '').replace(/[؟?!.]/g, '').trim();
  if (isGradesByTopicQuestion(question)) return false;

  // Specific entity or topic — let search/LLM handle it.
  if (
    /(?:مدرس(?:ة|ه)\s+\S+|مؤسس(?:ة|ه)\s+\S+|موضوع\s+\S+|ابحث\s+عن|ذكاء\s*اصطناع|subject|topic)/iu.test(
      q
    )
  ) {
    return false;
  }

  const wantsLocation =
    /(?:أين|اين|وين|where|كيف\s+(?:أ|ا)?(?:جد|اعثر|اوصل|ادخل|أصل|أوصل))/iu.test(q) ||
    /^أجد\s+/iu.test(q);

  const genericEdu =
    /(?:محتو(?:ى|ي)\s*تعليم|المحتو(?:ى|ي)\s*التعليم|تعليم(?:ي|ية)|دروس|مواد\s*دراس|فصول\s*دراس|صفوف|المناهج|القنوات\s*الإثر|استكشف\s*المحتو|curriculum|educational\s*content)/iu.test(
      q
    ) ||
    /^(?:أين\s+)?(?:أجد\s+)?(?:المحتو(?:ى|ي)\s*التعليم|محتو(?:ى|ي)\s*تعليم)/iu.test(q);

  return wantsLocation && genericEdu;
}

function extractHomeLinks(indexedPages = []) {
  const home = indexedPages.find((p) => p.path === '/');
  if (!home?.content) return [];

  const links = [];
  const re = /(.+?)\s*→\s*(\/[^\s\n]+)/g;
  let m;
  while ((m = re.exec(home.content))) {
    links.push({ label: m[1].trim(), path: m[2].trim() });
  }
  return links;
}

function eduHubLinks(links) {
  return links.filter((l) => {
    if (l.path === '/grades') return true;
    return /(?:قنوات\s*الإثر|إثرائ|مناهج|استكشف\s*المحتو|الفصول\s*الدراس|الصفوف\s*الدراس)/iu.test(
      l.label
    );
  });
}

function collectGradeChannels(indexedPages = []) {
  return indexedPages
    .filter((p) => /^\/grade\/[^/]+$/u.test(String(p.path || '')))
    .map((p) => ({ path: p.path, label: String(p.title || p.path).trim() }))
    .filter((g) => g.label);
}

function rankGradeChannels(grades) {
  const score = (label) => {
    const t = normalizeArabic(label);
    let s = 0;
    if (/مدرس|صف|ثانوي|ابتدائي|متوسط|مركز|وطني|ماده/.test(t)) s += 5;
    if (/من\s+الصف\s+الاول\s+ل/.test(t)) s += 4;
    if (/الصفوه|صفوه/.test(t)) s += 6;
    if (/منسك|اذاع|شركه|هيئ|مؤسس|اختبار/.test(t) && !/مدرس|مركز/.test(t)) s -= 1;
    return s;
  };
  return [...grades].sort(
    (a, b) => score(b.label) - score(a.label) || a.label.localeCompare(b.label, 'ar')
  );
}

/** Deterministic hub answer: /grades first, then featured grade channels. */
export function composeEducationalDiscoveryAnswer({ indexedPages = [], siteMap = [] }) {
  const homeLinks = extractHomeLinks(indexedPages);
  const hubs = eduHubLinks(homeLinks);
  const grades = rankGradeChannels(collectGradeChannels(indexedPages));

  const navigateTargets = [];
  const seen = new Set();
  const add = (path, label) => {
    const p = String(path || '').split('?')[0];
    if (!p || seen.has(p)) return;
    seen.add(p);
    navigateTargets.push({ path: p, label: String(label || p).trim() });
  };

  for (const hub of hubs) add(hub.path, hub.label);

  if (!seen.has('/grades')) {
    const gradesPage = siteMap.find((s) => s.path === '/grades');
    add('/grades', gradesPage?.title || 'القنوات الإثرائية');
  }

  const featured = grades.slice(0, 5);
  for (const g of featured) add(g.path, g.label);

  const hubLabel =
    hubs.find((h) => h.path === '/grades')?.label ||
    siteMap.find((s) => s.path === '/grades')?.title ||
    'اكتشف الصفوف الدراسية';

  const lines = [
    'المحتوى التعليمي متاح عبر **القنوات الإثرائية** في المنصة.',
    '',
    `• **${hubLabel}** — صفحة تجمع كل الفصول والمواد (${grades.length} قناة/فصل).`,
  ];

  if (featured.length) {
    lines.push('', '**أبرز القنوات:**');
    for (const g of featured.slice(0, 5)) {
      lines.push(`• ${g.label}`);
    }
  }

  lines.push('', 'اضغط الزر للانتقال، أو اسأل عن فصل/موضوع محدد (مثل: «مدرسة الصفوة»).');

  return {
    text: lines.join('\n'),
    navigateTargets: navigateTargets.slice(0, 6),
  };
}
