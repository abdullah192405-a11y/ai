// Detect content/course search questions and match against live page text + catalog + all indexed pages.

import { dedupeItems, mergeCatalogs } from './catalog.js';
import { isGradesByTopicQuestion, isExplicitSearchQuestion } from './gradesByTopic.js';
import { isEducationalDiscoveryQuestion } from './educationDiscovery.js';
import { isRouteQuestion, rankRoutesForQuestion } from './routes.js';

function normalizeArabic(w) {
  return String(w || '')
    .toLowerCase()
    .replace(/^ال/, '')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

const STOP = new Set([
  'ابحث', 'بحث', 'عن', 'find', 'search', 'for', 'the', 'a', 'an',
  'ما', 'هل', 'في', 'من', 'that', 'about', 'هي', 'هذا', 'this',
  'محتوى', 'محتوي', 'content', 'تتكلم', 'تتحدث', 'يتحدث', 'على', 'حول',
  'اين', 'وين', 'where', 'how', 'كيف', 'متى', 'when', 'why', 'لماذا',
  'اجد', 'اوجد', 'اريد', 'عندي', 'locate', 'access', 'get', 'show',
  'له', 'لها', 'لهم', 'علاقه', 'علاقة', 'related', 'with', 'some',
]);

const FILLER = new Set([
  'موضوع', 'مواضيع', 'topic', 'topics', 'محتو', 'محتوى', 'content',
  'دوره', 'دورات', 'course', 'courses', 'ماده', 'مواد', 'subject',
]);

const TERM_SYNONYMS = {
  حج: ['حج', 'حجاج', 'منسك', 'مناسك', 'نسك', 'مشاعر', 'عرفه', 'مزدلفه', 'طواف', 'سعي'],
  منسك: ['منسك', 'مناسك', 'حج', 'نسك'],
  نسك: ['نسك', 'منسك', 'حج'],
  احياء: ['احياء', 'احيائي', 'الاحياء', 'biology', 'bio', 'حيوي'],
  احيائي: ['احياء', 'احيائي', 'biology', 'bio'],
};

function stripArabicPrefix(word) {
  return String(word || '')
    .replace(/^([وبفك]|ال|لل)/, '')
    .replace(/^ال/, '');
}

export function searchTerms(question) {
  const q = String(question || '');
  const raw = q
    .toLowerCase()
    .split(/[\s,.;:!?،؟]+/)
    .map((w) => normalizeArabic(w))
    .map((w) => stripArabicPrefix(w))
    .filter((w) => w.length >= 2 && !STOP.has(w));

  const extra = [];
  for (const t of raw) {
    if (t === 'بنوك' || t === 'بنك' || t === 'مصرف') extra.push('بنك', 'بنوك', 'مصرف');
    if (t === 'سياره' || t === 'سيارات') extra.push('سيار', 'سيارات');
    for (const [key, syns] of Object.entries(TERM_SYNONYMS)) {
      if (t.includes(key) || key.includes(t)) extra.push(...syns);
    }
  }

  // Phrase hints: "منسك الحج", "علاقة بالحج"
  const normQ = normalizeArabic(q);
  if (/منسك|مناسك|نسك|حج/u.test(normQ)) {
    extra.push('حج', 'منسك', 'نسك', 'حجاج', 'طواف', 'عرف', 'مزد', 'نسك');
  }

  if (/ذكاء\s*اصطناع|artificial\s*intelligence|\bai\b/iu.test(q)) {
    extra.push('ذكاء', 'اصطناع', 'ai', 'artificial', 'intelligence');
  }

  return [...new Set([...raw, ...extra])];
}

export function coreSearchTerms(terms) {
  const core = terms.filter((t) => t.length >= 2 && !FILLER.has(t) && !STOP.has(t) && !GENERIC.has(t));
  return core.length ? core : terms.filter((t) => t.length >= 3 && !STOP.has(t));
}

const GENERIC = new Set([
  'مدرسه', 'مدرسة', 'دروس', 'درس', 'دوره', 'دورات', 'مؤسسه', 'مؤسسة',
  'اهليه', 'اهلي', 'الاهليه', 'الاهلي', 'خاصه', 'خاص', 'محتوي', 'محتوى',
]);

function termInText(text, term) {
  if (!term) return false;
  return text.includes(term);
}

function matchesTerms(blob, terms) {
  const text = normalizeArabic(blob);
  const core = coreSearchTerms(terms);
  if (!core.length) return false;
  return core.some((t) => termInText(text, t));
}

export function distinctiveTerms(terms) {
  return coreSearchTerms(terms);
}

function matchesTermsForScoring(blob, terms) {
  return matchesTerms(blob, terms);
}

export { matchesTerms };

export function isContentSearchQuestion(question) {
  const q = String(question || '').toLowerCase();
  return (
    /(?:ابحث|بحث|find|search|look\s+for|أريد|اريد|اعطني|أعطني|عندكم|موجود|هل\s+يوجد|هل\s+توجد)/u.test(q) ||
    /(?:دور(?:ة|ات)|course|courses|تحد(?:ي|يات)|challenge|محتوى|محتوي|content|مادة|مواد|درس|دروس|موضوع|مواضيع|topic|مدرس(?:ة|ه)|مؤسس(?:ة|ه)|شريك|مدارس|school|partner)/u.test(q) ||
    /(?:سيار(?:ة|ات)|car|cars|مرسيد|bmw|نيسان|تويوت|هيون|بورش|لامبور|فيراري|suv|سيدان|بنك|بنوك|تمويل|loan|bank|ممشى|سعر|أسعار|price)/u.test(q)
  );
}

/** "Where do I find X school/content?" — needs DB + route search */
export function needsCatalogSearch(question) {
  if (isContentSearchQuestion(question)) return true;
  const q = String(question || '').toLowerCase();
  return (
    /(?:أين|اين|وين|where|كيف\s+(?:أ|ا)?(?:جد|اوصل|ادخل))/u.test(q) &&
    /(?:محتو|مدرس|مؤسس|school|org|partner|صف|grade|دور|course|topic|شريك|سيار|car|بنك|bank|تمويل)/u.test(q)
  );
}

export function isPricingQuestion(question) {
  return /(?:pricing|price|أسعار|سعر|خطط|plan|plans|subscription|اشتراك|باق|package)/ui.test(
    String(question || '')
  );
}

function brandHintFromQuestion(question) {
  const q = normalizeArabic(String(question || ''));
  const brands = [
    ['تويوت', 'تويوتا'],
    ['toyota', 'تويوتا'],
    ['نissan', 'نissan'],
    ['نيسان', 'نissan'],
    ['bmw', 'bmw'],
    ['مرسيد', 'مرسيد'],
    ['benz', 'مرسيد'],
    ['هيون', 'هيون'],
    ['hyundai', 'هيون'],
    ['فورد', 'فورد'],
    ['ford', 'فورد'],
    ['لكزس', 'لكزس'],
    ['lexus', 'لكزس'],
    ['بورش', 'بورش'],
    ['porsche', 'بورش'],
    ['بيودي', 'byd'],
    ['byd', 'byd'],
    ['جيام', 'جي'],
    ['جي ام', 'جي'],
  ];
  for (const [needle, label] of brands) {
    if (q.includes(normalizeArabic(needle))) return label;
  }
  return null;
}

function isGenericSpaTitle(title) {
  const t = String(title || '').trim();
  return !t || t === 'ماكس موتورز' || /^ماكس\s*موتورز$/i.test(t);
}

function isBrandListingQuestion(question) {
  const q = String(question || '');
  if (!isCarQuestion(q)) return false;
  if (/\d{4}/.test(q) && /(?:اوربان|كروزر|كامري|هايل|لاند|راف|كراون|برادو|يaris|يارس|لاندكروزر)/iu.test(q)) {
    return false;
  }
  return (
    /(?:سيارات|سيارة|cars|عندكم|متوف|available|ما\s?هي|كل|جميع|أريد|اريد)/iu.test(q) ||
    (brandHintFromQuestion(q) && !/\d{4}/.test(q))
  );
}

function scoreItem(text, terms, item = {}, question = '') {
  const brand = brandHintFromQuestion(question);
  if (brand && item.type === 'car') {
    const blob = normalizeArabic(`${item.title} ${item.subject} ${item.description}`);
    if (!blob.includes(normalizeArabic(brand))) return 0;
  }

  if (!matchesTerms(text, terms)) return 0;
  const t = normalizeArabic(text);
  const core = coreSearchTerms(terms);
  let score = core.reduce((s, term) => (termInText(t, term) ? s + 2 : s), 0);

  // Boost when entity type matches question intent.
  const blob = core.join(' ');
  if (item.type === 'topic' && /(?:موضوع|topic|ابحث|بحث)/u.test(String(question || ''))) score += 4;
  if (item.type === 'grade' && /(?:صف|grade|مرحله)/u.test(String(question || ''))) score += 3;
  if (item.type === 'organization' && /(?:مدرس|مؤسس|school|org)/u.test(String(question || ''))) score += 3;
  if (
    (item.type === 'topic' || item.type === 'subject') &&
    isOrganizationQuestion(question) &&
    !isTopicSearchQuestion(question)
  ) {
    const titleBlob = normalizeArabic(`${item.title || ''} ${item.subject || ''}`);
    const titleHit = core.some((t) => termInText(titleBlob, t));
    const pathHit = core.some((t) => termInText(normalizeArabic(item.path || ''), t));
    if (pathHit && !titleHit) score -= 10;
  }
  if (/حج|منسك|نسك/u.test(blob) && /حج|منسك|نسك/u.test(t)) score += 5;
  if (item.type === 'car' && /(?:سيار|car|تويوت|نissan|bmw|مرسيد|اوربان|urban|كروزر|cruiser|suv)/u.test(blob)) {
    score += 3;
  }
  if (item.type === 'bank' && /(?:بنك|بنوك|مصرف|bank|تمويل|loan)/u.test(blob)) score += 5;
  // Penalize cars when user asks about banks/pages.
  if (item.type === 'car' && /(?:بنك|بنوك|صفح|page|bank)/u.test(blob) && !/(?:سيار|car)/u.test(blob)) {
    score -= 4;
  }

  return score;
}

function snippetsFromVisibleText(text, terms, limit = 8) {
  if (!text || !terms.length) return [];
  const chunks = String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?؟])\s+|(?=\s+\d+\s+مواد)|(?=\s+ثانوي\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  return chunks
    .map((c) => ({ text: c, score: scoreItem(c, terms, {}) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function matchesFromIndexedPages(pages, terms, question) {
  if (!pages?.length || !terms.length) return [];
  return pages
    .map((p) => ({
      title: p.title || p.path,
      description: String(p.content || '').slice(0, 180),
      path: p.path,
      type: 'page',
      source: 'indexed',
      score: scoreItem(`${p.title} ${p.content} ${p.path}`, terms, { type: 'page' }, question),
    }))
    .filter((x) => {
      if (x.score <= 0 || isGenericSpaTitle(x.title)) return false;
      const path = String(x.path || '');
      if (path === '/' || path === '') return false;
      if (isGradesByTopicQuestion(question) && !path.startsWith('/grade/')) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function isBankQuestion(question) {
  const q = String(question || '').toLowerCase();
  return /(?:بنك|بنوك|bank|تمويل|loan|مصرف)/u.test(q) && !/(?:سيار|car|urban|كروزر|cruiser|تويوت|toyota)/u.test(q);
}

function isCarQuestion(question) {
  return /(?:سيار|car|cars|تويوت|toyota|نissan|bmw|مرسيد|اوربان|urban|كروزر|cruiser|suv|موديل|model)/ui.test(
    String(question || '')
  );
}

function isOrganizationQuestion(question) {
  const q = String(question || '');
  return /(?:مدرس|مؤسس|school|org|partner|شريك|مدارس|جامعه|جامعة)/u.test(q);
}

function isTopicSearchQuestion(question) {
  return /(?:موضوع|مواضيع|topic|ابحث|بحث|محتو)/u.test(String(question || ''));
}

function wantsMultipleNavigateResults(question) {
  return (
    isBrandListingQuestion(question) ||
    /(?:كل|جميع|all|list|اعرض|أعرض|show\s+me\s+all|كم\s+عدد|how\s+many|أكثر\s+من)/iu.test(
      String(question || '')
    )
  );
}

function pathSegments(path) {
  return String(path || '').split('?')[0].split('/').filter(Boolean);
}

function isChildPath(childPath, parentPath) {
  const child = String(childPath || '').split('?')[0];
  const parent = String(parentPath || '').split('?')[0];
  if (!parent || child === parent) return false;
  return child.startsWith(parent.endsWith('/') ? parent : `${parent}/`);
}

function isShallowEntityPath(path) {
  const p = String(path || '').split('?')[0];
  return /^\/grade\/[^/]+$/u.test(p) || /^\/org\/[^/]+$/u.test(p);
}

function pickOrganizationNavigateTarget(matches, pageMatches = []) {
  const org =
    matches.find((m) => m.type === 'organization' || m.type === 'grade') ||
    matches.find((m) => isShallowEntityPath(m.path));
  if (org?.path) return org;

  const page =
    pageMatches.find((p) => isShallowEntityPath(p.path)) ||
    pageMatches.find((p) => /\/grade\/|\/org\//u.test(p.path || ''));
  if (page?.path) return page;

  return null;
}

function dropChildPaths(matches) {
  const sorted = [...matches].sort((a, b) => pathSegments(a.path).length - pathSegments(b.path).length);
  const kept = [];
  for (const m of sorted) {
    const path = String(m.path || '').split('?')[0];
    if (!path) continue;
    if (kept.some((k) => isChildPath(path, k.path))) continue;
    kept.push({ ...m, path });
  }
  return kept.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/** Pick the best navigate target for a question — avoids blindly using matches[0]. */
export function pickNavigateAction({ question, searchResult, routes = [] }) {
  if (isRouteQuestion(question)) {
    const ranked = rankRoutesForQuestion(question, routes, { limit: 1 });
    if (ranked[0]?.path) {
      return { path: ranked[0].path, title: ranked[0].label || ranked[0].path, type: 'route' };
    }
  }

  const matches = searchResult?.matches || [];

  if (isTopicSearchQuestion(question)) {
    const topic =
      matches.find((m) => (m.type === 'topic' || m.type === 'page') && m.path) ||
      (searchResult?.pageMatches || []).find((p) => p.path);
    if (topic?.path) return topic;
  }

  if (isBankQuestion(question)) {
    const bank = matches.find((m) => m.type === 'bank' && m.path);
    if (bank) return bank;
    const bankPage = (searchResult?.pageMatches || []).find((p) => /\/banks?\/?$/i.test(p.path || ''));
    if (bankPage?.path) return bankPage;
    const ranked = rankRoutesForQuestion(question, routes, { limit: 3 });
    const bankRoute = ranked.find((r) => /bank/i.test(r.path));
    if (bankRoute?.path) {
      return { path: bankRoute.path, title: bankRoute.label, type: 'route' };
    }
  }

  if (isCarQuestion(question)) {
    const car = matches.find((m) => m.type === 'car' && m.path);
    if (car && !isBrandListingQuestion(question)) return car;
    if (isBrandListingQuestion(question)) {
      const carsPage = routes.find((r) => r.path === '/cars' && r.accessible);
      if (carsPage) {
        return { path: '/cars', title: 'تصفح السيارات', type: 'route' };
      }
    }
    const ranked = rankRoutesForQuestion(question, routes, { limit: 8 });
    const carRoute = ranked.find((r) => r.path.startsWith('/cars/') && r.score > 0);
    if (carRoute) {
      return { path: carRoute.path, title: carRoute.label, type: 'route' };
    }
  }

  if (isOrganizationQuestion(question) && !isTopicSearchQuestion(question)) {
    const org = pickOrganizationNavigateTarget(matches, searchResult?.pageMatches || []);
    if (org?.path) return org;
  }

  if (matches[0]?.path) {
    if (isBankQuestion(question) && matches[0].type === 'car') {
      const alt = matches.find((m) => m.type !== 'car' && m.path);
      if (alt) return alt;
    }
    return matches[0];
  }

  const pageMatch = searchResult?.pageMatches?.[0];
  if (pageMatch?.path) return pageMatch;

  const ranked = rankRoutesForQuestion(question, routes, { limit: 1 });
  if (ranked[0]?.path) {
    return { path: ranked[0].path, title: ranked[0].label, type: 'route' };
  }

  return null;
}

function cleanNavigateTitle(title) {
  return String(title || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim()
    .slice(0, 80);
}

/** Navigate targets — one by default; multiple when search/list intent or several matches. */
export function pickNavigateActions({ question, searchResult, routes = [], limit = 4 } = {}) {
  const matches = (searchResult?.matches || []).filter(
    (m) => m?.path && String(m.path).startsWith('/')
  );

  const allowMultiple =
    wantsMultipleNavigateResults(question) ||
    isGradesByTopicQuestion(question) ||
    (isExplicitSearchQuestion(question) && matches.length > 1);

  if (!allowMultiple) {
    const single = pickNavigateAction({ question, searchResult, routes });
    if (single?.path) {
      return [
        {
          path: String(single.path).split('?')[0],
          title: cleanNavigateTitle(single.title) || single.path,
          label: cleanNavigateTitle(single.title) || single.path,
        },
      ];
    }
    return [];
  }

  if (matches.length) {
    const ranked = dropChildPaths(matches);
    const seen = new Set();
    const out = [];
    for (const m of ranked) {
      const path = String(m.path).split('?')[0];
      if (seen.has(path)) continue;
      seen.add(path);
      const label = cleanNavigateTitle(m.title) || path;
      out.push({ path, title: label, label });
      if (out.length >= limit) break;
    }
    if (out.length) return out;
  }

  const single = pickNavigateAction({ question, searchResult, routes });
  return single?.path ? [single] : [];
}

export function suggestRoutesForSearch({ question, result, routes = [] }) {
  const suggestions = [];
  const seen = new Set();

  const isKnown = (path) => {
    if (!routes.length) return true;
    const base = String(path).split('?')[0];
    return routes.some((r) => r.accessible && (r.path === path || r.path === base));
  };

  const add = (path, label, { allowUnknown = false } = {}) => {
    if (!path || seen.has(path)) return;
    if (!allowUnknown && !isKnown(path)) return;
    seen.add(path);
    suggestions.push({ path, label: label || path });
  };

  for (const m of result.matches) {
    if (m.path && String(m.path).startsWith('/')) {
      add(m.path, m.title || m.path, { allowUnknown: true });
    }
  }

  if (isBrandListingQuestion(question)) {
    add('/cars', 'تصفح السيارات');
  }

  for (const p of result.pageMatches || []) {
    if (p.path && p.path !== '/') add(p.path, p.title || p.path);
  }

  for (const r of rankRoutesForQuestion(question, routes, { limit: 4 })) {
    add(r.path, r.label);
  }

  return suggestions.slice(0, 4);
}

function matchesFromDocumentChunks(chunks, terms, question) {
  if (!chunks?.length || !terms.length) return [];
  return chunks
    .map((c) => ({
      title: c.title || c.document_title || 'مستند',
      description: String(c.content || '').slice(0, 180),
      type: 'document',
      source: 'upload',
      score: scoreItem(
        `${c.title} ${c.content} ${c.document_title}`,
        terms,
        { type: 'document' },
        question
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

export function searchSiteContent({
  question,
  livePageContext,
  catalog,
  dbItems = [],
  indexedPages = [],
  documentChunks = [],
}) {
  if (isEducationalDiscoveryQuestion(question)) {
    const grades = indexedPages
      .filter((p) => /^\/grade\/[^/]+$/u.test(String(p.path || '')))
      .map((p) => ({
        title: p.title || p.path,
        path: p.path,
        type: 'grade',
        source: 'indexed',
        score: 10,
      }))
      .slice(0, 8);
    const gradesHub = indexedPages.find((p) => p.path === '/grades');
    const hub = gradesHub
      ? [{ title: gradesHub.title || 'اكتشف الصفوف', path: '/grades', type: 'route', score: 20 }]
      : [];
    return {
      terms: [],
      matches: dedupeItems([...hub, ...grades]),
      pageMatches: [],
      snippets: [],
    };
  }

  const terms = searchTerms(question);
  const allItems = mergeCatalogs(catalog, { items: dbItems, source: 'database' });

  if (!terms.length) {
    return {
      terms: [],
      matches: allItems.slice(0, 15),
      pageMatches: [],
      snippets: [],
    };
  }

  const matched = dedupeItems(
    allItems
      .map((item) => ({
        ...item,
        score: scoreItem(
          `${item.title} ${item.description} ${item.subject} ${item.grade} ${item.path}`,
          terms,
          item,
          question
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  );

  const pageMatches = matchesFromIndexedPages(indexedPages, terms, question);
  const docMatches = matchesFromDocumentChunks(documentChunks, terms, question);
  const snippets = snippetsFromVisibleText(livePageContext?.visible_text, terms);

  const catalogOnly = isGradesByTopicQuestion(question);
  const merged = dedupeItems([
    ...matched.filter((m) => !catalogOnly || m.type === 'topic' || m.type === 'subject' || m.type === 'grade'),
    ...docMatches,
    ...(catalogOnly ? [] : pageMatches.map((p) => ({ ...p, type: p.type || 'page' }))),
  ])
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  return { terms, matches: merged, pageMatches, snippets };
}

export function formatContentSearchContext({ question, result, routes = [] }) {
  const suggestions = suggestRoutesForSearch({ question, result, routes });
  const topMatches = result.matches.slice(0, 6);
  const topPages = (result.pageMatches || []).slice(0, 2);

  const lines = [
    '--- نتائج البحث (للاستخدام الداخلي — لا تنسخها حرفياً للمستخدم) ---',
    `سؤال البحث: ${question}`,
    `كلمات البحث: ${result.terms.join('، ') || '(عام)'}`,
    '',
  ];

  if (topMatches.length) {
    const carCount = result.matches.filter((m) => m.type === 'car').length;
    if (carCount > 1) {
      lines.push(`سيارات/نتائج مطابقة: ${carCount} (عرض أول ${topMatches.length})`);
    } else {
      lines.push('نتائج مطابقة:');
    }
    for (const m of topMatches) {
      const extra = [m.subject, m.grade, m.type === 'document' ? 'مستند مرفوع' : m.type]
        .filter(Boolean)
        .join(' · ');
      lines.push(`- ${m.title}${extra ? ` (${extra})` : ''}`);
    }
    lines.push('');
  }

  if (topPages.length) {
    lines.push('صفحات مفهرسة (للتنقل فقط — لا تسردها للمستخدم):');
    for (const p of topPages) {
      lines.push(`- ${p.title || p.path} (${p.path})`);
    }
    lines.push('');
  }

  if (result.snippets.length) {
    lines.push('مقتطفات من الصفحة الحالية:');
    for (const s of result.snippets.slice(0, 2)) {
      lines.push(`- ${s.text.slice(0, 180)}${s.text.length > 180 ? '…' : ''}`);
    }
    lines.push('');
  }

  if (suggestions.length) {
    lines.push('مسار التنقل المقترح (زر واحد عبر ACTIONS_JSON):');
    lines.push(`- ${suggestions[0].path} — ${suggestions[0].label}`);
    lines.push('');
  }

  if (!topMatches.length && !topPages.length && !result.snippets.length) {
    lines.push(
      'لم تُعثر على نتائج مطابقة.',
      'قل ذلك باختصار واقترح أقرب مسار ✓ من قائمة مسارات هذا الموقع.'
    );
  } else {
    lines.push(
      'لخص للمستخدم: عدد النتائج + 3–5 أسماء — بدون مسارات خام وبدون خطوات تحليل.'
    );
  }

  return lines.join('\n');
}

export function buildPricingContext(siteKnowledge, question) {
  if (!isPricingQuestion(question)) return '';
  const text = String(siteKnowledge || '').trim();
  if (!text) {
    return [
      '=== الأسعار والخطط ===',
      'لا توجد معلومات أسعار في إعدادات الموقع.',
      'قل ذلك ووجّه المستخدم للتواصل مع إدارة المنصة.',
    ].join('\n');
  }

  const blocks = text.split(/\n\n+/);
  const pricingBlocks = blocks.filter((b) =>
    /(?:سعر|أسعار|pricing|plan|plans|اشتراك|باق|package|مجان|subscription)/ui.test(b)
  );
  const body = pricingBlocks.length ? pricingBlocks.join('\n\n') : text;

  return [
    '=== معلومات الأسعار والخطط (من معرفة الموقع — أجب منها حرفياً) ===',
    body,
    '',
    'لا تقل "غير متوفرة" إذا وُجدت معلومات أعلاه.',
  ].join('\n');
}

export function contentSearchSystemInstructions() {
  return `[تعليمات بحث داخلية — لا تظهر في رد المستخدم]
- استخدم بيانات Supabase/القائمة أعلاه للإجابة.
- إن وُجدت سيارات مطابقة: اذكر العدد التقريبي و3–5 أسماء — لا تقل "لا توجد نتائج" إذا وُجدت في السياق.
- زر تنقل واحد فقط عبر ACTIONS_JSON — لا تسرد مسارات /cars/uuid في النص.`;
}

/** @deprecated — instructions moved to system prompt */
export function contentSearchThinkingPrefix(question) {
  if (!isContentSearchQuestion(question) && !needsCatalogSearch(question)) return '';
  return '';
}

export { mergeCatalogs };
