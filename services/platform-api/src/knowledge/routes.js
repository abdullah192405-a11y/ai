// Site route registry: discover paths per website, validate navigation actions.

const PATH_LINE = /^-\s*(\/[a-zA-Z0-9/_?=&%-]+)\s*(?:[—\-–:]\s*(.+))?$/;

function normalizePath(raw) {
  if (!raw) return '/';
  let p = String(raw).trim();
  if (!p.startsWith('/')) p = `/${p}`;
  try {
    const u = new URL(p, 'http://local');
    return u.pathname || '/';
  } catch {
    return '/';
  }
}

function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/^ال/, '')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function questionTerms(question) {
  const stop = new Set([
    'ابحث', 'بحث', 'عن', 'find', 'search', 'for', 'the', 'a', 'an',
    'ما', 'هل', 'في', 'من', 'where', 'how', 'to', 'go',
  ]);
  return String(question || '')
    .toLowerCase()
    .split(/[\s,.;:!?،؟]+/)
    .map((w) => normalizeSearchText(w))
    .filter((w) => w.length >= 2 && !stop.has(w));
}

export function pathsFromSiteKnowledge(text) {
  const routes = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.trim().match(PATH_LINE);
    if (m) routes.push({ path: normalizePath(m[1]), title: (m[2] || '').trim(), source: 'owner' });
  }
  return routes;
}

export function buildRouteRegistry({ siteMap = [], siteKnowledge = '', currentPath = '/' }) {
  const byPath = new Map();

  for (const p of siteMap) {
    const path = normalizePath(p.path);
    byPath.set(path, {
      path,
      title: p.title || '',
      source: 'crawled',
      accessible: true,
    });
  }

  for (const p of pathsFromSiteKnowledge(siteKnowledge)) {
    if (!byPath.has(p.path)) {
      byPath.set(p.path, {
        path: p.path,
        title: p.title,
        source: 'owner',
        accessible: false,
      });
    } else if (p.title && !byPath.get(p.path).title) {
      byPath.get(p.path).title = p.title;
    }
  }

  const routes = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  return { routes, currentPath: normalizePath(currentPath) };
}

function decodePathSafe(path) {
  try {
    return decodeURIComponent(String(path));
  } catch {
    return String(path);
  }
}

/** Merge routes discovered from live DOM, catalog/API items, and indexed pages. */
export function mergeDynamicRoutes(
  routes,
  { liveLinks = [], catalogItems = [], indexedPages = [], matchedItems = [] } = {}
) {
  const byPath = new Map(routes.map((r) => [normalizePath(r.path), { ...r }]));
  const matchedPaths = new Set(
    matchedItems.filter((i) => i.path).map((i) => normalizePath(decodePathSafe(i.path)))
  );
  const livePaths = new Set(
    liveLinks.map((l) => normalizePath(l.path || l.href || '')).filter(Boolean)
  );

  const add = (rawPath, title, source, accessible = true) => {
    if (!rawPath) return;
    const path = normalizePath(decodePathSafe(rawPath));
    if (!path) return;
    const existing = byPath.get(path);
    if (!existing) {
      byPath.set(path, { path, title: title || path, source, accessible });
      return;
    }
    if (title && (!existing.title || existing.title === existing.path)) existing.title = title;
    else if (title && source === 'catalog') existing.title = title;
    if (accessible) existing.accessible = true;
    if (source === 'live') existing.source = 'live';
    else if (source === 'catalog' || source === 'indexed') existing.source = source;
  };

  for (const link of liveLinks) {
    add(link.path || link.href, link.title || link.text, 'live', true);
  }

  for (const item of catalogItems) {
    if (!item.path || !String(item.path).startsWith('/')) continue;
    const path = normalizePath(decodePathSafe(item.path));
    const segments = path.split('/').filter(Boolean).length;
    const isMatched = matchedPaths.has(path);
    const isLive = livePaths.has(path);
    const isOrg = item.type === 'organization' || path.startsWith('/org/');
    const isCatalogEntity = ['car', 'bank', 'article', 'company', 'featured', 'review', 'topic', 'subject', 'organization'].includes(
      item.type
    );

    let title = item.title;
    if (item.type === 'bank' && path === '/banks') {
      title = 'البنوك والتمويل';
    }

    if (item.type === 'grade' && !isMatched && !isLive) continue;
    if (isOrg || isMatched || isLive || isCatalogEntity || segments <= 1) {
      add(path, title, 'catalog', true);
    }
  }

  for (const page of indexedPages) {
    if (page.path) add(page.path, page.title, 'indexed', true);
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** Demote crawled SPA shell pages (same title on many paths = not real routes). */
export function pruneSpaShellRoutes(routes) {
  const crawled = routes.filter((r) => r.source === 'crawled');
  const titleCounts = new Map();
  for (const r of crawled) {
    if (!r.title) continue;
    titleCounts.set(r.title, (titleCounts.get(r.title) || 0) + 1);
  }

  return routes.map((r) => {
    if (r.source !== 'crawled' || r.path === '/') return r;
    if ((titleCounts.get(r.title) || 0) >= 3) {
      return { ...r, accessible: false };
    }
    return r;
  });
}

function scoreRoute(route, terms, question) {
  const blob = normalizeSearchText(`${route.path} ${route.title}`);
  let score = 0;
  for (const term of terms) {
    if (blob.includes(term)) score += 3;
    const segments = route.path.split('/').filter(Boolean).map(normalizeSearchText);
    if (segments.some((s) => s.includes(term) || term.includes(s))) score += 2;
  }

  const q = String(question || '').toLowerCase();
  const intentPatterns = [
    { re: /(?:مدرس|مؤسس|شريك|partner|school|org)/u, keys: ['partner', 'school', 'org', 'مدرس', 'مؤسس', 'شريك'] },
    { re: /(?:دور|course|grade|topic|درس|محتو|subject|تحد)/u, keys: ['course', 'grade', 'topic', 'subject', 'content', 'دور', 'درس', 'محتو'] },
    { re: /(?:login|register|sign|تسجيل|دخول|انضم)/u, keys: ['login', 'register', 'sign', 'join', 'تسجيل', 'دخول'] },
    { re: /(?:dashboard|لوحة)/u, keys: ['dashboard', 'admin', 'teacher', 'student'] },
    { re: /(?:بنك|بنوك|bank|تمويل|loan|مصرف)/u, keys: ['bank', 'banks', 'بنك', 'بنوك', 'تمويل'] },
    { re: /(?:سيار|car|cars|سيارات|موديل)/u, keys: ['car', 'cars', 'سيار', 'سيارات'] },
  ];

  for (const { re, keys } of intentPatterns) {
    if (!re.test(q)) continue;
    for (const key of keys) {
      if (blob.includes(normalizeSearchText(key))) score += 4;
    }
  }

  if (route.path === '/') score -= 1;
  return score;
}

/** Rank discovered ✓ routes for a question — no hardcoded site paths. */
export function rankRoutesForQuestion(question, routes, { limit = 4 } = {}) {
  const accessible = routes.filter((r) => r.accessible);
  const terms = questionTerms(question);

  if (!terms.length) {
    return accessible
      .filter((r) => r.path !== '/')
      .slice(0, limit)
      .map((r) => ({ path: r.path, label: r.title || r.path }));
  }

  const ranked = accessible
    .map((r) => ({
      path: r.path,
      label: r.title || r.path,
      score: scoreRoute(r, terms, question),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
    .slice(0, limit);

  if (ranked.length) return ranked;

  return accessible
    .filter((r) => r.path !== '/')
    .slice(0, limit)
    .map((r) => ({ path: r.path, label: r.title || r.path }));
}

export function isRouteQuestion(question) {
  const q = String(question || '').toLowerCase();
  return (
    /(?:أين|اين|وين|where|كيف\s+(?:أ|ا)?(?:ذهب|اوصل|ادخل|انضم|سجل)|how\s+(?:do\s+i|to)\s+(?:go|find|access|join|register))/u.test(q) ||
    /(?:صفحة|مسار|route|path|url|رابط|قسم|تسجيل|انضم|login|register|signup|dashboard)/u.test(q)
  );
}

export function formatRouteMapForPrompt(routes, { currentPath } = {}) {
  if (!routes.length) {
    return [
      'لا توجد مسارات مكتشفة بعد لهذا الموقع.',
      'استخدم روابط الصفحة الحية و/أو اطلب من المالك إضافة خريطة المسارات في siteKnowledge.',
      'لا تقترح أزرار تنقل قبل وجود مسارات ✓.',
    ].join('\n');
  }

  const accessible = routes.filter((r) => r.accessible);
  const capped = accessible.length > 35
    ? [
        ...accessible.filter((r) => r.source === 'live'),
        ...accessible.filter((r) => r.source === 'catalog'),
        ...accessible.filter((r) => r.source === 'owner'),
        ...accessible.filter((r) => r.source === 'crawled' || r.source === 'indexed'),
      ].filter((r, i, arr) => arr.findIndex((x) => x.path === r.path) === i).slice(0, 35)
    : accessible;

  const lines = [
    '--- مسارات هذا الموقع (مكتشفة — استخدمها فقط للتنقل) ---',
    '✓ = متاح (مفهرس / حي / من API) | ~ = مذكور من المالك (تحقق)',
    '',
  ];

  for (const r of routes) {
    if (r.accessible && !capped.some((c) => c.path === r.path)) continue;
    const mark = r.accessible ? '✓' : '~';
    const here = r.path === currentPath ? ' ← أنت هنا' : '';
    const src = r.source ? ` [${r.source}]` : '';
    lines.push(`${mark} ${r.path} — ${r.title || '(بدون عنوان)'}${here}${src}`);
  }

  lines.push(
    '',
    'قواعد صارمة:',
    '- كل موقع له مسارات مختلفة — لا تفترض مسارات من مواقع أخرى.',
    '- راجع القائمة أعلاه أولاً واختر المسار الأنسب للسؤال.',
    '- للتنقل استخدم فقط المسارات بعلامة ✓.',
    '- لا تخترع مسارات غير موجودة في القائمة.'
  );

  return lines.join('\n');
}

export function routeSystemInstructions() {
  return `[تعليمات داخلية — لا تظهر في رد المستخدم]
- راجع مسارات هذا الموقع (✓) واختر الأنسب للتنقل.
- لا تخترع مسارات غير موجودة في القائمة.
- اذكر للمستخدم اسم الصفحة/القسم فقط — المسار يذهب لزر ACTIONS_JSON.`;
}

/** @deprecated use routeSystemInstructions in system prompt */
export function routeThinkingPrefix(question) {
  if (!isRouteQuestion(question)) return '';
  return routeSystemInstructions();
}

function pathScore(a, b) {
  const na = normalizePath(a);
  const nb = normalizePath(b);
  if (na === nb) return 100;
  if (na.startsWith(nb + '/') || nb.startsWith(na + '/')) return 80;
  const pa = na.split('/').filter(Boolean);
  const pb = nb.split('/').filter(Boolean);
  const shared = pa.filter((s, i) => pb[i] === s).length;
  return shared * 10;
}

function bestAccessibleMatch(url, accessibleRoutes) {
  let best = null;
  let bestScore = 0;
  for (const r of accessibleRoutes) {
    const s = pathScore(url, r.path);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return bestScore >= 10 ? best : null;
}

export function validateNavigateActions(actions, routes) {
  const accessible = routes.filter((r) => r.accessible);

  const findRoute = (url) => {
    const path = normalizePath(url);
    const decoded = decodePathSafe(path);
    return accessible.find(
      (r) =>
        r.path === path ||
        r.path === decoded ||
        decodePathSafe(r.path) === decoded ||
        decodePathSafe(r.path) === path
    );
  };

  return actions
    .map((a) => {
      if (a.type !== 'navigate' || !a.url) return a;

      const hit = findRoute(a.url);
      if (hit) {
        return { ...a, url: hit.path, label: a.label || hit.title || hit.path };
      }

      const match =
        bestAccessibleMatch(a.url, accessible) ||
        bestAccessibleMatch(decodePathSafe(a.url), accessible);
      if (match) {
        const urlPath = normalizePath(a.url);
        const urlSegs = urlPath.split('/').filter(Boolean).length;
        const matchSegs = match.path.split('/').filter(Boolean).length;
        // Never downgrade a specific path (e.g. /cars/uuid) to a parent (/cars).
        if (urlSegs > matchSegs) return null;
        return {
          ...a,
          url: match.path,
          label: a.label || `الذهاب إلى ${match.title || match.path}`,
        };
      }

      // Trust Supabase catalog paths for car detail pages even if not crawled yet.
      if (/^\/cars\/[0-9a-f-]{36}$/i.test(normalizePath(a.url))) {
        return { ...a, url: normalizePath(a.url), label: a.label || a.url };
      }

      const norm = normalizePath(a.url);
      if (
        /^\/grade\/[^/]+\/subject\/[0-9a-f-]{36}\/topic\/[0-9a-f-]{36}$/i.test(norm) ||
        /^\/grade\/[^/]+\/subject\/[0-9a-f-]{36}$/i.test(norm) ||
        /^\/org\/[^/]+$/i.test(norm)
      ) {
        return { ...a, url: norm, label: a.label || norm };
      }

      return null;
    })
    .filter(Boolean);
}

const verifyCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function probePath(baseUrl, path) {
  const key = `${baseUrl}${path}`;
  const cached = verifyCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ok;

  const url = new URL(path, baseUrl).href;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  let ok = false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'WBA-RouteCheck/1.0', Accept: '*/*' },
    });
    ok = res.ok || res.status === 304;
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }

  verifyCache.set(key, { ok, at: Date.now() });
  return ok;
}

// Verify owner-declared routes that were not crawled yet.
export async function verifyUndeclaredRoutes({ baseUrl, routes, maxChecks = 8 }) {
  const toCheck = routes.filter((r) => !r.accessible && r.source === 'owner').slice(0, maxChecks);
  await Promise.all(
    toCheck.map(async (r) => {
      const ok = await probePath(baseUrl, r.path);
      if (ok) r.accessible = true;
    })
  );
  return routes;
}

/** @deprecated use mergeDynamicRoutes */
export const enrichRoutesFromCatalog = mergeDynamicRoutes;
