import * as cheerio from 'cheerio';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { query } from '../db.js';
import { resolveCrawlDepth } from './crawlDepth.js';

import { MAX_STORED_CONTENT_CHARS } from './knowledgeLimits.js';
import { upsertIndexedPage } from './indexedPagesStore.js';

const FETCH_TIMEOUT_MS = 25000;
const BROWSER_SCORE_THRESHOLD = 3;
const MAX_BUNDLE_BYTES = 2_500_000;
const MAX_PAGE_CONTENT_CHARS = MAX_STORED_CONTENT_CHARS;

const CRAWL_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function crawlHeaders({ acceptHtml = false, referer } = {}) {
  const headers = {
    'User-Agent': CRAWL_UA,
    Accept: acceptHtml
      ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      : '*/*',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
  };
  if (referer) headers.Referer = referer;
  return headers;
}

/** Typical store / company pages — used when sitemap or homepage links are thin. */
const COMMON_SITE_PATHS = [
  '/about', '/about-us', '/من-نحن',
  '/contact', '/contact-us', '/تواصل', '/اتصل-بنا',
  '/blog', '/news', '/articles', '/المدونة',
  '/shop', '/store', '/products', '/collections', '/collections/all', '/category',
  '/المتجر', '/المنتجات',
  '/services', '/خدماتنا',
  '/faq', '/faqs', '/الأسئلة-الشائعة',
  '/privacy', '/privacy-policy', '/سياسة-الخصوصية',
  '/terms', '/terms-of-service',
  '/pricing', '/الاسعار',
  '/ar', '/en',
  '/pages', '/brands', '/offers', '/العروض',
];

function crawlEmit(onProgress, phase, text, meta) {
  if (meta && Object.keys(meta).length) {
    console.log(`[crawl] ${phase} — ${text}`, meta);
  } else {
    console.log(`[crawl] ${phase} — ${text}`);
  }
  onProgress?.({ phase, text, meta: meta && Object.keys(meta).length ? meta : undefined });
}

function normalizeBaseUrl(raw) {
  const u = new URL(raw);
  return `${u.protocol}//${u.host}`;
}

/** Compare hosts allowing apex ↔ www (e.g. tech2go.solutions vs www.tech2go.solutions). */
function siteHostname(host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
}

function sameSiteHost(a, b) {
  try {
    const ha = siteHostname(typeof a === 'string' && a.includes('://') ? new URL(a).hostname : a);
    const hb = siteHostname(typeof b === 'string' && b.includes('://') ? new URL(b).hostname : b);
    return ha === hb;
  } catch {
    return false;
  }
}

function sameOrigin(base, href) {
  try {
    const resolved = new URL(href, base);
    const baseUrl = new URL(base);
    return resolved.origin === baseUrl.origin;
  } catch {
    return false;
  }
}

function registrableDomain(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return h;
  return parts.slice(-2).join('.');
}

function sameRegistrableSite(base, href) {
  try {
    const resolved = new URL(href, base);
    const baseUrl = new URL(base);
    return registrableDomain(baseUrl.hostname) === registrableDomain(resolved.hostname);
  } catch {
    return false;
  }
}

/** Same registrable domain — apex ↔ www; optional subdomains when subdomains=true. */
function sameSite(base, href, { subdomains = false } = {}) {
  if (subdomains) return sameRegistrableSite(base, href);
  try {
    const resolved = new URL(href, base);
    const baseUrl = new URL(base);
    return sameSiteHost(baseUrl.hostname, resolved.hostname);
  } catch {
    return false;
  }
}

function indexedPath(pageUrl, baseUrl) {
  const u = new URL(pageUrl);
  const b = new URL(baseUrl);
  const pathname = u.pathname + u.search;
  const normalized = normalizeSeedPath(pathname) || '/';
  if (siteHostname(u.hostname) === siteHostname(b.hostname)) return normalized;
  if (!sameRegistrableSite(baseUrl, pageUrl)) return null;
  return `/@${u.hostname.toLowerCase()}${normalized}`;
}

function crawlTargetFromHref(href, base, { subdomains = false, includeCatalogPaths = false } = {}) {
  try {
    const resolved = new URL(href, base);
    if (!sameSite(base, resolved.href, { subdomains })) return null;
    const path = indexedPath(resolved.href, base);
    if (!path || !isCrawlablePath(path.split('?')[0])) return null;
    if (!includeCatalogPaths && isEducationCatalogPath(path)) return null;
    return { url: resolved.href, path };
  } catch {
    return null;
  }
}

function toPath(base, href) {
  const resolved = new URL(href, base);
  const path = resolved.pathname + resolved.search;
  return path || '/';
}

function normalizeSeedPath(raw) {
  if (!raw) return null;
  let p = String(raw).trim();
  if (!p.startsWith('/')) p = `/${p}`;
  try {
    return new URL(p, 'http://local').pathname || '/';
  } catch {
    return null;
  }
}

function isCrawlablePath(path) {
  if (!path || path === '/') return true;
  const clean = path.split('?')[0] || path;
  if (clean.includes('*') || /\/:[A-Za-z]/.test(clean)) return false;
  if (/\.(png|jpe?g|gif|svg|ico|css|js|mjs|map|woff2?|ttf|pdf|zip|json)$/i.test(clean)) return false;
  if (/\/cdn-cgi(\/|$)/i.test(clean)) return false;
  if (/\/(wp-admin|wp-login\.php|cart|checkout)(\/|$)/i.test(clean)) return false;
  return true;
}

const UUID_SEGMENT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Education-platform catalog paths synced via Supabase — not generic UUID detail pages. */
function isEducationCatalogPath(path) {
  if (!path || path.startsWith('/db/')) return false;
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return false;

  const head = segments[0].toLowerCase();
  if (head === 'grade') return segments.length > 1;
  if (segments.some((s) => s === 'subject' || s === 'topic' || s === 'course' || s === 'challenge')) {
    return true;
  }
  if ((head === 'org' || head === 'organization') && segments.length > 2) return true;
  if (head === 'car' && segments.length > 1) return true;

  return false;
}

/** @deprecated use isEducationCatalogPath */
function isCatalogDeepPath(path) {
  return isEducationCatalogPath(path);
}

function filterPathsForWebCrawl(paths) {
  return [...new Set(paths)].filter((p) => isCrawlablePath(p));
}

const LOADING_RE = /^loading(\.{0,3})?(\s|$)/i;
const BOILERPLATE_RE =
  /loading (testimonials|trust badges|faqs|services|content)\.{0,3}|no spam, unsubscribe|all rights reserved/gi;

function slugToTitle(slug) {
  return decodeURIComponent(String(slug || ''))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLoadingText(text) {
  return LOADING_RE.test(String(text || '').trim());
}

function normalizeTitleText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericSiteTitle(title, siteDefaultTitle) {
  const t = normalizeTitleText(title).toLowerCase();
  if (!t || t.length < 3) return true;
  if (isLoadingText(t)) return true;
  const site = normalizeTitleText(siteDefaultTitle).toLowerCase();
  if (site && t === site) return true;
  if (site && site.length > 12 && (t.includes(site) || site.includes(t))) return true;
  if (/^سكولاريوم للمنح/i.test(title) && /scholarium/i.test(t)) return true;
  if (/scholarium scholarships/i.test(t)) return true;
  if (t.includes('leading it solutions') && t.includes('technology consulting')) return true;
  return false;
}

function navLabelToTitle(label) {
  const text = normalizeTitleText(label);
  if (!text) return '';
  const primary = text.split('|')[0].trim();
  return primary || text;
}

function titleFromMetaAndDocument($, siteDefaultTitle) {
  const og = normalizeTitleText($('meta[property="og:title"]').attr('content'));
  if (og && !isGenericSiteTitle(og, siteDefaultTitle)) return og;

  const docTitle = normalizeTitleText($('title').first().text());
  if (!docTitle) return '';
  for (const part of docTitle.split('|').map((p) => p.trim()).filter(Boolean)) {
    if (part.length > 3 && !isGenericSiteTitle(part, siteDefaultTitle)) return part;
  }
  return '';
}

function pathFallbackTitle(path) {
  if (path === '/') return 'الرئيسية';
  const known = {
    '/about': 'من نحن',
    '/services': 'خدماتنا',
    '/projects': 'المشاريع',
    '/blog': 'المدونة',
    '/maqalat': 'مقالات',
    '/store': 'المتجر',
    '/careers': 'الوظائف',
    '/contact': 'اتصل بنا',
    '/scholarships': 'المنح الدراسية',
    '/courses': 'الدورات',
    '/requirements': 'المتطلبات',
    '/faq': 'الأسئلة الشائعة',
    '/document-samples': 'نماذج المستندات',
    '/login': 'تسجيل الدخول',
    '/privacy-policy': 'سياسة الخصوصية',
    '/terms-of-service': 'شروط الاستخدام',
  };
  if (known[path]) return known[path];
  const seg = path.split('/').filter(Boolean).pop() || path;
  if (UUID_SEGMENT.test(seg)) {
    const parent = path.split('/').filter(Boolean).slice(-2, -1)[0] || '';
    if (parent === 'scholarships') return 'منحة دراسية';
  }
  return slugToTitle(seg);
}

function buildNavLabelMap(html, base) {
  const $ = cheerio.load(html);
  const byPath = new Map();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = normalizeTitleText($(el).text());
    if (!href || !text || text.length < 2 || text.length > 80) return;
    if (!sameSite(base, href)) return;
    const path = normalizeSeedPath(toPath(base, href));
    if (!path) return;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(text);
  });

  const labels = new Map();
  for (const [path, texts] of byPath) {
    const unique = [...new Set(texts)];
    if (unique.length >= 3) continue;
    const slug = (path.split('/').filter(Boolean).pop() || '').toLowerCase();
    const matched = unique.find((t) => t.toLowerCase().includes(slug));
    labels.set(path, matched || unique.sort((a, b) => a.length - b.length)[0]);
  }
  return labels;
}

function extractJsonLd($) {
  const parts = [];
  const add = (k, v) => {
    if (v == null) return;
    const text = typeof v === 'string' ? v.trim() : String(v).trim();
    if (text.length > 2) parts.push(`${k}: ${text.slice(0, 4000)}`);
  };

  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 8) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (node['@graph']) walk(node['@graph'], depth + 1);

    const type = node['@type'];
    if (type) add('النوع', Array.isArray(type) ? type.join(', ') : type);
    add('الاسم', node.name || node.headline || node.item?.name);
    add('الوصف', node.description);
    if (node.articleBody) add('المقال', node.articleBody);
    if (node.text) add('النص', node.text);
    add('SKU', node.sku || node.productID);
    add('العلامة', node.brand?.name || node.brand);
    add('التصنيف', node.category);
    add('هاتف', node.telephone);
    add('بريد', node.email);
    if (node.address) {
      const a = node.address;
      add(
        'العنوان',
        [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
          .filter(Boolean)
          .join('، ') || (typeof a === 'string' ? a : '')
      );
    }

    const offers = node.offers
      ? Array.isArray(node.offers)
        ? node.offers
        : [node.offers]
      : [];
    for (const o of offers) {
      if (!o || typeof o !== 'object') continue;
      add('السعر', o.price);
      add('العملة', o.priceCurrency);
      add('التوفر', o.availability);
    }

    if (node.aggregateRating) {
      add('التقييم', node.aggregateRating.ratingValue);
      add('عدد التقييمات', node.aggregateRating.reviewCount);
    }

    const entities = node.mainEntity
      ? Array.isArray(node.mainEntity)
        ? node.mainEntity
        : [node.mainEntity]
      : [];
    for (const q of entities) {
      if (!q || typeof q !== 'object') continue;
      add('سؤال', q.name);
      const ans = q.acceptedAnswer?.text || q.acceptedAnswer?.name || q.acceptedAnswer;
      add('جواب', typeof ans === 'string' ? ans : ans?.text);
    }

    const list = node.itemListElement
      ? Array.isArray(node.itemListElement)
        ? node.itemListElement
        : [node.itemListElement]
      : [];
    for (const item of list.slice(0, 80)) {
      const name = item?.name || item?.item?.name || item?.item?.headline;
      const url = item?.item?.['@id'] || item?.item?.url || item?.url;
      if (name) add('عنصر', url ? `${name} (${url})` : name);
    }

    add('الرابط', typeof node.url === 'string' ? node.url : '');
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).html() || ''));
    } catch {
      /* skip invalid json-ld */
    }
  });
  return parts.join('\n');
}

function extractJsonLdUrls($) {
  const urls = [];
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 8) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (node['@graph']) walk(node['@graph'], depth + 1);
    for (const key of ['url', '@id']) {
      const v = node[key];
      if (typeof v === 'string' && /^https?:\/\//i.test(v) && !v.startsWith('https://schema.org')) {
        urls.push(v);
      }
    }
    if (node.item) walk(node.item, depth + 1);
    if (node.itemListElement) walk(node.itemListElement, depth + 1);
    if (node.offers) walk(node.offers, depth + 1);
    if (node.mainEntity) walk(node.mainEntity, depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).html() || ''));
    } catch {
      /* skip */
    }
  });
  return urls;
}

function extractNextFlightText(html) {
  const texts = new Set();
  const re = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const decoded = m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    for (const s of decoded.matchAll(/"([A-Za-z\u0600-\u06FF][^"\\]{8,400})"/g)) {
      const t = s[1].trim();
      if (/^(static|chunks|webpack|className|children|segmentPath|__PAGE__|href|src|type|id)$/i.test(t)) continue;
      if (/^[a-z]+(?:Id|Key|Url|Path|Ref|Token)$/i.test(t)) continue;
      if (/\.(js|css|woff2?|svg|png|jpg|jpeg|webp|gif|map|tsx?|jsx?)$/i.test(t)) continue;
      if (/^[0-9a-f-]{36}$/i.test(t)) continue;
      texts.add(t);
    }
  }
  return [...texts].slice(0, 250).join('\n');
}

const JSON_TEXT_KEYS = new Set([
  'title', 'name', 'headline', 'description', 'body', 'content', 'text',
  'excerpt', 'summary', 'subtitle', 'label', 'question', 'answer', 'bio',
  'caption', 'quote', 'paragraph', 'intro', 'details', 'overview', 'tagline',
  'heading', 'subheading', 'message', 'value', 'placeholder', 'alt',
  'price', 'sku', 'brand', 'category', 'faq', 'address', 'phone', 'email',
  'city', 'country', 'availability', 'features', 'spec', 'specs',
]);

function collectJsonText(node, depth, out, seen) {
  if (depth > 14 || out.length >= 400) return;
  if (node == null) return;

  if (typeof node === 'string') {
    const t = node.replace(/\s+/g, ' ').trim();
    if (t.length < 4 || t.length > 8000) return;
    if (/^https?:\/\//i.test(t)) return;
    if (/^[0-9a-f-]{36}$/i.test(t)) return;
    if (/\.(js|css|png|jpe?g|svg|woff2?|map|tsx?|jsx?)$/i.test(t)) return;
    if (/^[\d\s.,:;+\-/()[\]{}]+$/.test(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) collectJsonText(item, depth + 1, out, seen);
    return;
  }

  if (typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node)) {
    if (JSON_TEXT_KEYS.has(String(key).toLowerCase())) {
      collectJsonText(value, depth + 1, out, seen);
    }
  }
  for (const value of Object.values(node)) {
    collectJsonText(value, depth + 1, out, seen);
  }
}

function extractEmbeddedAppData(html) {
  const parts = [];
  const nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const texts = [];
      collectJsonText(data, 0, texts, new Set());
      if (texts.length) parts.push(texts.slice(0, 200).join('\n'));
    } catch {
      /* skip invalid next data */
    }
  }

  for (const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const texts = [];
      collectJsonText(data, 0, texts, new Set());
      if (texts.length) parts.push(texts.slice(0, 120).join('\n'));
    } catch {
      /* skip */
    }
  }

  const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i);
  if (nuxtMatch) {
    try {
      const data = JSON.parse(nuxtMatch[1]);
      const texts = [];
      collectJsonText(data, 0, texts, new Set());
      if (texts.length) parts.push(texts.slice(0, 120).join('\n'));
    } catch {
      /* skip */
    }
  }

  return parts.join('\n\n').slice(0, 40000);
}

function extractStructuredContent($) {
  const parts = [];
  const selectors = [
    'main p', 'main li', 'main td', 'main th', 'main blockquote', 'main figcaption',
    'main dt', 'main dd', 'main label', 'main span[data-content]',
    'article p', 'article li', '[role="main"] p', '[role="main"] li',
    'section p', 'section li', '.content p', '.content li', '#content p', '#content li',
    '[itemprop="description"]', '[itemprop="name"]', '[itemprop="price"]',
    '.product p', '.product li', '.product-title', '.product-name',
    '.faq p', '.faq li', 'details summary', 'details p',
    '.woocommerce-product-details__short-description',
    '.entry-content p', '.entry-content li', '.post-content p',
    '[class*="product-title"]', '[class*="product-name"]', '[class*="ProductCard"]',
    '.salla-product-card', '[data-product-id]', '.product-item',
    '.shopify-section p', '.product__description', '.product-single__description',
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const t = normalizeTitleText($(el).text());
      if (t.length < 3 || t.length > 2000 || isLoadingText(t)) return;
      parts.push(t);
    });
  }

  $('main button, main [aria-label], main img[alt], article [aria-label], article img[alt], img[alt]').each((_, el) => {
    const label =
      normalizeTitleText($(el).attr('aria-label')) ||
      normalizeTitleText($(el).attr('alt')) ||
      normalizeTitleText($(el).text());
    if (label.length >= 2 && label.length <= 160 && !isLoadingText(label)) parts.push(label);
  });

  return cleanVisibleText([...new Set(parts)].join('\n'));
}

function extractCommerceAndContact($) {
  const parts = [];
  const add = (label, val) => {
    const v = normalizeTitleText(val);
    if (v.length >= 2 && v.length <= 400) parts.push(`${label}: ${v}`);
  };

  $('[class*="price"], [class*="Price"], [itemprop="price"], [data-price], .amount, .money').each((_, el) => {
    const t = normalizeTitleText($(el).attr('content') || $(el).attr('data-price') || $(el).text());
    if (t && /[\d]/.test(t) && t.length < 80) add('السعر', t);
  });

  $('a[href^="tel:"]').each((_, el) => add('هاتف', $(el).attr('href').replace(/^tel:/i, '') || $(el).text()));
  $('a[href^="mailto:"]').each((_, el) => add('بريد', $(el).attr('href').replace(/^mailto:/i, '') || $(el).text()));
  $('[itemprop="telephone"], [itemprop="email"], [itemprop="streetAddress"]').each((_, el) => {
    add($(el).attr('itemprop'), $(el).attr('content') || $(el).text());
  });

  $('details').each((_, el) => {
    const q = normalizeTitleText($(el).find('summary').first().text());
    const a = normalizeTitleText($(el).clone().children('summary').remove().end().text());
    if (q && a) {
      add('سؤال', q);
      add('جواب', a.slice(0, 1500));
    }
  });

  return [...new Set(parts)].slice(0, 80).join('\n');
}

function extractInternalLinkTexts($, base) {
  const lines = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = normalizeTitleText($(el).text());
    if (!href || !text || text.length < 2 || text.length > 100) return;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (!sameSite(base, href)) return;
    try {
      const path = normalizeSeedPath(toPath(base, href));
      if (!path) return;
      lines.push(`${text} → ${path}`);
    } catch {
      /* skip */
    }
  });
  const unique = [...new Set(lines)];
  if (!unique.length) return '';
  return `روابط الصفحة:\n${unique.slice(0, 150).join('\n')}`;
}

function pickBestTitle($, pageUrl, navLabels, siteDefaultTitle) {
  const path = new URL(pageUrl).pathname || '/';

  const metaTitle = titleFromMetaAndDocument($, siteDefaultTitle);
  if (metaTitle) return metaTitle;

  const nav = navLabels.get(path);
  if (nav && !isLoadingText(nav)) {
    const navTitle = navLabelToTitle(nav);
    if (navTitle) return navTitle;
  }

  const h1 = normalizeTitleText($('main h1').first().text() || $('h1').first().text());
  if (h1 && !isLoadingText(h1) && !isGenericSiteTitle(h1, siteDefaultTitle)) return h1;

  const h2 = normalizeTitleText($('main h2').first().text() || $('h2').first().text());
  if (h2 && !isLoadingText(h2) && h2.length > 4 && !isGenericSiteTitle(h2, siteDefaultTitle)) return h2;

  return pathFallbackTitle(path);
}

function cleanVisibleText(text) {
  return String(text || '')
    .replace(BOILERPLATE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function substantiveBodyLength(content) {
  return String(content || '')
    .replace(/^مسار الصفحة:.*$/gm, '')
    .replace(/^عنوان الصفحة:.*$/gm, '')
    .replace(/^الوصف:.*$/gm, '')
    .replace(/^og:.*$/gm, '')
    .replace(/^الكلمات:.*$/gm, '')
    .replace(/^روابط الصفحة:[\s\S]*?(?=\n\n|$)/gm, '')
    .replace(/\[تطبيق React\/SPA[^\]]*\]/g, '')
    .replace(/\[محتوى من Supabase[^\]]*\]/g, '')
    .replace(/\[محتوى عام من قاعدة البيانات[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .length;
}

function scorePageQuality(page, siteDefaultTitle) {
  let score = 0;
  const bodyLen = substantiveBodyLength(page.content);
  if (page.title && !isGenericSiteTitle(page.title, siteDefaultTitle)) score += 2;
  if (bodyLen > 2500) score += 4;
  else if (bodyLen > 1200) score += 3;
  else if (bodyLen > 600) score += 2;
  else if (bodyLen > 250) score += 1;
  else score -= 3;
  if (page.headings.filter((h) => h.text && !isLoadingText(h.text)).length >= 2) score += 1;
  if (!/loading (testimonials|faqs|trust badges|services)/i.test(page.content)) score += 1;
  if (/failed to load|project not found|try again later/i.test(page.content)) score -= 4;
  return score;
}

function needsBrowserRender(page, cfg, siteDefaultTitle) {
  if (isErrorShellPage(page)) return false;
  const bodyLen = substantiveBodyLength(page.content);
  const score = scorePageQuality(page, siteDefaultTitle);
  const thin = score < BROWSER_SCORE_THRESHOLD || bodyLen < 800;
  if (!thin) return false;
  return Boolean(cfg.browserAllThin || cfg.maxBrowserPages > 0);
}

function isErrorShellPage(page) {
  return /failed to load|project not found|try again later|errorfailed/i.test(page.content || '');
}

function isLocalCrawlUrl(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]';
  } catch {
    return false;
  }
}

function formatFetchError(err, url) {
  const code = err?.code || '';
  const msg = String(err?.message || err || 'unknown');
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
    const port = (() => {
      try {
        return new URL(url).port || '80';
      } catch {
        return '';
      }
    })();
    if (isLocalCrawlUrl(url)) {
      return `الموقع غير متاح (ECONNREFUSED:${port}) — شغّل خادم التطوير على المنفذ ${port} ثم أعد الزحف`;
    }
    return `الموقع غير متاح (ECONNREFUSED) — تحقق من الرابط أو جدار الحماية`;
  }
  if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(msg)) return 'تعذّر resolve للنطاق (ENOTFOUND)';
  if (/timeout/i.test(msg)) return 'انتهت مهلة الاتصال';
  if (/HTTP \d+/i.test(msg)) return msg;
  if (/not html/i.test(msg)) return 'الاستجابة ليست HTML';
  return msg.slice(0, 120);
}

/** Thin SPA shells: keep route title + heading hints without slow browser render. */
function enrichSpaShellPage(page, path) {
  if (page.content.length > 900) return page;
  const headingText = page.headings
    .map((h) => h.text)
    .filter(Boolean)
    .slice(0, 8)
    .join(' · ');
  const extra = [
    headingText ? `عناوين فرعية: ${headingText}` : null,
    `[تطبيق React/SPA — جزء من المحتوى يُحمّل في المتصفح]`,
  ].filter(Boolean);
  return {
    ...page,
    content: [...extra, page.content].filter(Boolean).join('\n\n').slice(0, MAX_PAGE_CONTENT_CHARS),
  };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Math.min(concurrency, items.length);
  if (workers === 0) return results;
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

function extractMeta($, pageUrl, { siteDefaultDescription = '', siteDefaultTitle = '' } = {}) {
  const parts = [];
  const add = (label, val) => {
    const v = (val || '').trim();
    if (v) parts.push(`${label}: ${v}`);
  };
  const desc = ($('meta[name="description"]').attr('content') || '').trim();
  if (desc && desc !== siteDefaultDescription) add('الوصف', desc);

  const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim();
  if (ogTitle && !isGenericSiteTitle(ogTitle, siteDefaultTitle)) add('og:title', ogTitle);

  const ogDesc = ($('meta[property="og:description"]').attr('content') || '').trim();
  if (ogDesc && ogDesc !== siteDefaultDescription) add('og:description', ogDesc);

  add('الكلمات', $('meta[name="keywords"]').attr('content'));
  return parts.join('\n');
}

function extractPage(html, pageUrl, { navLabels = new Map(), siteDefaultTitle = '', siteDefaultDescription = '' } = {}) {
  const $ = cheerio.load(html);
  const jsonLdText = extractJsonLd($);
  const embeddedData = extractEmbeddedAppData(html);
  const flightText = extractNextFlightText(html);
  $('script, style, noscript, iframe, svg').remove();

  const path = new URL(pageUrl).pathname || '/';
  const title = pickBestTitle($, pageUrl, navLabels, siteDefaultTitle);
  const metaText = extractMeta($, pageUrl, { siteDefaultDescription, siteDefaultTitle });
  const structuredText = extractStructuredContent($);
  const commerceText = extractCommerceAndContact($);
  const linkTexts = extractInternalLinkTexts($, pageUrl);

  const headings = [];
  $('main h1, main h2, main h3, main h4, h1, h2, h3, h4').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const text = normalizeTitleText($(el).text()).slice(0, 200);
    if (!text || isLoadingText(text)) return;
    headings.push({
      tag: tag || 'el',
      text,
      id: $(el).attr('id') || null,
      selector: null,
    });
  });

  const fallbackMainText = cleanVisibleText($('main').text() || $('body').text());
  const mainText =
    structuredText.length > fallbackMainText.length * 0.6 ? structuredText : fallbackMainText;
  const pathNote = `مسار الصفحة: ${path}`;
  const titleNote = `عنوان الصفحة: ${title}`;
  const content = [
    pathNote,
    titleNote,
    metaText,
    jsonLdText,
    commerceText,
    embeddedData,
    flightText,
    linkTexts,
    mainText,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_PAGE_CONTENT_CHARS);

  const links = [];
  $('a[href], link[rel="next"], link[rel="prev"], link[rel="alternate"], link[rel="canonical"]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim() || $(el).attr('rel') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
      return;
    links.push({ href, text: text.slice(0, 120) });
  });
  for (const href of extractJsonLdUrls($)) {
    links.push({ href, text: 'jsonld' });
  }

  return { title, content, headings, links };
}

function dedupeTitles(pages, siteDefaultTitle) {
  const titleCounts = new Map();
  for (const p of pages) {
    const t = p.title || '';
    titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
  }

  return pages.map((p) => {
    const count = titleCounts.get(p.title) || 0;
    if (count >= 2 && isGenericSiteTitle(p.title, siteDefaultTitle)) {
      return { ...p, title: pathFallbackTitle(p.path) };
    }
    if (count >= 2 && p.path !== '/') {
      const h1 = p.headings.find((h) => h.tag === 'h1' && h.text);
      if (h1?.text) return { ...p, title: h1.text };
      return { ...p, title: pathFallbackTitle(p.path) };
    }
    return p;
  });
}

async function fetchText(url, { acceptHtml = false, redirectDepth = 0 } = {}) {
  const parsed = new URL(url);
  const lib = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy(new Error('timeout'));
    }, FETCH_TIMEOUT_MS);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: crawlHeaders({
          acceptHtml,
          referer: `${parsed.protocol}//${parsed.host}/`,
        }),
      },
      (res) => {
        const finish = (err, body) => {
          clearTimeout(timer);
          if (err) reject(err);
          else resolve(body);
        };

        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          try {
            const next = new URL(res.headers.location, url);
            if (!sameSite(url, next.href)) {
              finish(new Error(`external redirect ${res.statusCode}`));
              return;
            }
            if (redirectDepth >= 8) {
              finish(new Error('too many redirects'));
              return;
            }
            fetchText(next.href, { acceptHtml, redirectDepth: redirectDepth + 1 })
              .then((html) => finish(null, html))
              .catch(finish);
            return;
          } catch (err) {
            finish(err);
            return;
          }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          finish(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (
          acceptHtml &&
          ct &&
          !ct.includes('text/html') &&
          !ct.includes('application/xhtml') &&
          !ct.includes('text/plain') &&
          !ct.includes('application/octet-stream')
        ) {
          res.resume();
          finish(new Error('not html'));
          return;
        }

        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BUNDLE_BYTES) {
            req.destroy(new Error('too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const enc = String(res.headers['content-encoding'] || '').toLowerCase();
          const done = (err, out) => {
            if (err) finish(err);
            else finish(null, Buffer.isBuffer(out) ? out.toString('utf8') : String(out));
          };
          if (enc.includes('gzip')) {
            zlib.gunzip(buf, (err, out) => (err ? done(null, buf) : done(null, out)));
          } else if (enc.includes('deflate')) {
            zlib.inflate(buf, (err, out) => (err ? done(null, buf) : done(null, out)));
          } else if (enc.includes('br')) {
            zlib.brotliDecompress(buf, (err, out) => (err ? done(null, buf) : done(null, out)));
          } else done(null, buf);
        });
        res.on('error', finish);
      }
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

async function fetchHtml(url) {
  return fetchText(url, { acceptHtml: true });
}

/** Transient failures worth a retry — timeouts, resets, and 5xx/429 responses. */
function isRetryableFetchError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE'].includes(code)) return true;
  if (/timeout/i.test(msg)) return true;
  const status = msg.match(/HTTP (\d{3})/);
  if (status) {
    const n = Number(status[1]);
    return n === 408 || n === 429 || n >= 500;
  }
  return false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch HTML with bounded retries + backoff for flaky pages on deep crawls. */
async function fetchHtmlWithRetry(url, retries = 0) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchHtml(url);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries || !isRetryableFetchError(err)) break;
      await sleep(400 * (attempt + 1) + Math.floor(Math.random() * 200));
    }
  }
  throw lastErr;
}

/** Follow redirects (including apex → www) and return the final crawl base URL. */
export async function resolveCanonicalBaseUrl(rawUrl) {
  const start = normalizeBaseUrl(rawUrl);
  const probe = start + (new URL(rawUrl).pathname !== '/' ? new URL(rawUrl).pathname : '/');

  return new Promise((resolve, reject) => {
    const parsed = new URL(probe);
    const lib = parsed.protocol === 'https:' ? https : http;
    const timer = setTimeout(() => {
      req.destroy(new Error('timeout'));
    }, FETCH_TIMEOUT_MS);

    const follow = (currentUrl, depth) => {
      const u = new URL(currentUrl);
      const client = u.protocol === 'https:' ? https : http;
      const request = client.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search,
          method: 'GET',
          headers: crawlHeaders({ acceptHtml: true }),
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            if (depth >= 8) {
              clearTimeout(timer);
              reject(new Error('too many redirects'));
              return;
            }
            try {
              const next = new URL(res.headers.location, currentUrl);
              if (!sameSite(currentUrl, next.href)) {
                clearTimeout(timer);
                reject(new Error(`external redirect ${res.statusCode}`));
                return;
              }
              follow(next.href, depth + 1);
            } catch (err) {
              clearTimeout(timer);
              reject(err);
            }
            return;
          }
          res.resume();
          clearTimeout(timer);
          resolve(normalizeBaseUrl(u.href));
        }
      );
      request.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      request.end();
    };

    follow(probe, 0);
  });
}

function extractRoutePathsFromSource(text, out) {
  const patterns = [
    /\bpath:\s*['"]([^'"]+)['"]/g,
    /\bto:\s*['"](\/[^'"]+)['"]/g,
    /<\s*Route[^>]*\spath=['"]([^'"]+)['"]/g,
    /['"](\/(?:org|grade|grades|courses|course|cars|car|banks|bank|features|pricing|demo|subjects|subject|topics|topic|login|register|dashboard)[a-zA-Z0-9/_-]*)['"]/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const p = normalizeSeedPath(m[1]);
      if (p && isCrawlablePath(p)) out.add(p);
    }
  }
}

function extractImportPaths(text) {
  const imports = [];
  const re = /(?:import|from)\s+['"]([^'"]+\.(?:jsx?|tsx?))['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

async function discoverRoutesFromBundles(html, base, { maxBundles = 10 } = {}) {
  const $ = cheerio.load(html);
  const scriptUrls = new Set();
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) scriptUrls.add(new URL(src, base).href);
  });

  const paths = new Set();
  const fetched = new Set();
  const queue = [...scriptUrls];

  while (queue.length > 0 && fetched.size < maxBundles) {
    const url = queue.shift();
    if (fetched.has(url)) continue;
    fetched.add(url);

    let text;
    try {
      text = await fetchText(url);
    } catch {
      continue;
    }

    extractRoutePathsFromSource(text, paths);

    for (const imp of extractImportPaths(text)) {
      try {
        const resolved = new URL(imp, url).href;
        if (sameSite(base, resolved) && !fetched.has(resolved)) {
          queue.push(resolved);
        }
      } catch {
        /* skip */
      }
    }
  }

  return [...paths];
}

async function discoverSitemapTargets(baseUrl, { subdomains = false, maxSitemaps = 10 } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const targets = new Map();
  const pending = new Set([
    new URL('/sitemap.xml', base).href,
    new URL('/sitemap_index.xml', base).href,
    new URL('/sitemap-index.xml', base).href,
    new URL('/wp-sitemap.xml', base).href,
    new URL('/sitemap/sitemap.xml', base).href,
    new URL('/product-sitemap.xml', base).href,
    new URL('/page-sitemap.xml', base).href,
    new URL('/post-sitemap.xml', base).href,
    new URL('/category-sitemap.xml', base).href,
    new URL('/sitemap_products_1.xml', base).href,
    new URL('/sitemap_pages_1.xml', base).href,
    new URL('/sitemap_collections_1.xml', base).href,
    new URL('/sitemap_blogs_1.xml', base).href,
    new URL('/sitemaps.xml', base).href,
  ]);
  const fetched = new Set();

  try {
    const robots = await fetchText(new URL('/robots.txt', base).href);
    for (const line of robots.split('\n')) {
      const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
      if (m) pending.add(m[1].trim());
    }
  } catch {
    /* no robots */
  }

  while (pending.size > 0 && fetched.size < maxSitemaps) {
    const smUrl = pending.values().next().value;
    pending.delete(smUrl);
    if (fetched.has(smUrl)) continue;
    fetched.add(smUrl);

    try {
      if (!sameSite(base, smUrl, { subdomains })) continue;
      const xml = await fetchText(smUrl);

      if (/<sitemapindex/i.test(xml)) {
        const smRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
        let sm;
        while ((sm = smRe.exec(xml)) !== null) {
          if (sameSite(base, sm[1], { subdomains })) pending.add(sm[1].trim());
        }
        continue;
      }

      const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let m;
      while ((m = locRe.exec(xml)) !== null) {
        const t = crawlTargetFromHref(m[1].trim(), base, { subdomains, includeCatalogPaths: true });
        if (t) targets.set(t.path, t.url);
      }
    } catch {
      /* skip bad sitemap */
    }
  }

  return [...targets.entries()].map(([path, url]) => ({ path, url }));
}

async function discoverSitemapPaths(baseUrl) {
  return (await discoverSitemapTargets(baseUrl)).map((t) => t.path);
}

/** Discover SPA / static routes before BFS (sitemap + JS bundles + seeds). */
export async function discoverRoutes(baseUrl, seedPaths = [], { homeHtml = null, maxBundles = 10, subdomains = false, includeCatalogPaths = false } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const paths = new Set();
  const siteOpts = { subdomains, includeCatalogPaths };

  for (const raw of seedPaths) {
    const p = normalizeSeedPath(raw);
    if (p && isCrawlablePath(p)) paths.add(p);
  }

  try {
    const html = homeHtml || (await fetchHtml(base + '/'));
    for (const p of await discoverRoutesFromBundles(html, base, { maxBundles })) paths.add(p);
    const page = extractPage(html, base + '/');
    for (const link of page.links) {
      const t = crawlTargetFromHref(link.href, base, siteOpts);
      if (t) paths.add(t.path);
    }
  } catch (err) {
    console.warn('[crawl] discover home failed:', err.message);
  }

  for (const t of await discoverSitemapTargets(baseUrl, { subdomains, maxSitemaps: 40 })) {
    paths.add(t.path);
  }

  paths.add('/');
  return filterPathsForWebCrawl([...paths]);
}

async function buildCrawlTargets(base, cfg, extraPaths, homeHtml, onProgress) {
  const siteOpts = {
    subdomains: cfg.crawlSubdomains,
    includeCatalogPaths: cfg.includeCatalogPaths !== false,
  };
  const targets = new Map();

  const addHref = (href, fromBase = base) => {
    const t = crawlTargetFromHref(href, fromBase, siteOpts);
    if (t && !targets.has(t.path)) targets.set(t.path, t.url);
  };

  for (const raw of filterPathsForWebCrawl(extraPaths)) {
    addHref(raw.startsWith('http') ? raw : new URL(raw, base).href, base);
  }

  for (const p of COMMON_SITE_PATHS) {
    addHref(new URL(p, base).href, base);
  }

  for (const p of await discoverRoutes(base, extraPaths, {
    homeHtml,
    maxBundles: cfg.maxBundles,
    subdomains: cfg.crawlSubdomains,
    includeCatalogPaths: cfg.includeCatalogPaths !== false,
  })) {
    addHref(new URL(p, base).href, base);
  }

  for (const t of await discoverSitemapTargets(base, {
    subdomains: cfg.crawlSubdomains,
    maxSitemaps: cfg.maxSitemaps,
  })) {
    targets.set(t.path, t.url);
  }

  if (cfg.crawlSubdomains) {
    const origins = new Set([base]);
    for (const url of targets.values()) origins.add(normalizeBaseUrl(url));
    for (const origin of origins) {
      if (origin === base) continue;
      try {
        crawlEmit(onProgress, 'discover', `اكتشاف نطاق فرعي: ${origin}`);
        for (const t of await discoverSitemapTargets(origin, {
          subdomains: true,
          maxSitemaps: cfg.maxSitemaps,
        })) {
          targets.set(t.path, t.url);
        }
        const html = await fetchHtml(origin + '/');
        const page = extractPage(html, origin + '/');
        for (const link of page.links) addHref(link.href, origin);
      } catch {
        /* skip unreachable subdomain */
      }
    }
  }

  if (cfg.followLinks) {
    crawlEmit(onProgress, 'discover', `تتبع روابط الصفحات الداخلية (حتى ${cfg.maxPages} صفحة HTML)…`);
    let round = 0;
    let frontier = [...targets.values()];
    const seen = new Set(frontier);

    while (
      frontier.length > 0 &&
      targets.size < cfg.maxPages &&
      round < (cfg.linkFollowRounds || 5)
    ) {
      round += 1;
      const batch = frontier.splice(0, Math.min(frontier.length, cfg.fetchConcurrency * 3));
      const found = [];
      const deadUrls = [];

      await mapPool(batch, cfg.fetchConcurrency, async (url) => {
        try {
          const html = await fetchHtmlWithRetry(url, cfg.fetchRetries || 0);
          const page = extractPage(html, url);
          for (const link of page.links) {
            const t = crawlTargetFromHref(link.href, url, siteOpts);
            if (t && !targets.has(t.path) && targets.size + found.length < cfg.maxPages) {
              found.push(t);
            }
          }
        } catch (err) {
          if (/HTTP (404|410)/i.test(String(err?.message || ''))) deadUrls.push(url);
        }
      });

      if (deadUrls.length) {
        const dead = new Set(deadUrls);
        for (const [path, url] of [...targets.entries()]) {
          if (dead.has(url)) targets.delete(path);
        }
      }

      for (const t of found) {
        if (targets.size >= cfg.maxPages) break;
        targets.set(t.path, t.url);
        if (!seen.has(t.url)) {
          seen.add(t.url);
          frontier.push(t.url);
        }
      }
    }
  }

  return [...targets.entries()]
    .slice(0, cfg.maxPages)
    .map(([path, url]) => ({ path, url }));
}

// Parallel crawl — discover routes, fetch pages concurrently, optional browser for thin pages.
export async function crawlSite({
  baseUrl,
  tenantId,
  websiteId,
  extraPaths = [],
  onProgress,
  depth,
} = {}) {
  const cfg = resolveCrawlDepth(depth);
  const t0 = Date.now();
  crawlEmit(onProgress, 'start', `بدء زحف صفحات الموقع (${cfg.labelAr}) على ${baseUrl}`, { depth: cfg.id });

  let resolvedBase;
  try {
    resolvedBase = await resolveCanonicalBaseUrl(baseUrl);
  } catch (err) {
    console.warn('[crawl] canonical resolve failed, using input URL:', err.message);
    resolvedBase = normalizeBaseUrl(baseUrl);
  }

  const base = resolvedBase;
  const localDev = isLocalCrawlUrl(base);
  const redirected = base !== normalizeBaseUrl(baseUrl);
  if (redirected) {
    crawlEmit(onProgress, 'resolve', `تم التوجيه من ${normalizeBaseUrl(baseUrl)} إلى ${base}`);
  } else {
    crawlEmit(
      onProgress,
      'resolve',
      localDev
        ? `العنوان: ${base} (localhost — يُستخدم المتصفح للصفحات الرقيقة)`
        : `العنوان: ${base}`
    );
  }
  const startPath = new URL(baseUrl).pathname || '/';
  const startUrl = base + (startPath === '/' ? '/' : startPath);

  let navLabels = new Map();
  let siteDefaultTitle = '';
  let siteDefaultDescription = '';
  let homeHtml = null;
  let homeFetchError = null;
  try {
    homeHtml = await fetchHtml(base + '/');
    navLabels = buildNavLabelMap(homeHtml, base);
    const $home = cheerio.load(homeHtml);
    siteDefaultTitle = normalizeTitleText($home('title').first().text());
    siteDefaultDescription = ($home('meta[name="description"]').attr('content') || '').trim();
  } catch (err) {
    homeFetchError = err;
    console.warn('[crawl] home prefetch failed:', err.message);
    crawlEmit(onProgress, 'resolve', formatFetchError(err, base + '/'), {
      unreachable: true,
      error: err.message,
    });
  }

  const extractOpts = { navLabels, siteDefaultTitle, siteDefaultDescription };

  let browserRender = null;
  const useBrowser = cfg.maxBrowserPages > 0;
  if (useBrowser) {
    try {
      const mod = await import('./browserRenderer.js');
      if (await mod.isBrowserRenderingAvailable()) {
        browserRender = mod.renderPageHtml;
      }
    } catch {
      /* playwright optional */
    }
  }

  const discovered = await buildCrawlTargets(
    base,
    cfg,
    [...filterPathsForWebCrawl(extraPaths), normalizeSeedPath(startPath) || '/'],
    homeHtml,
    onProgress
  );
  const crawlPaths = discovered.map((t) => t.path);
  const subdomainCount = crawlPaths.filter((p) => p.startsWith('/@')).length;
  const discoverMsg =
    subdomainCount > 0
      ? `اكتشاف ${crawlPaths.length} صفحة (${subdomainCount} من نطاقات فرعية)`
      : `اكتشاف ${crawlPaths.length} صفحة HTML للزحف`;
  crawlEmit(onProgress, 'discover', discoverMsg, {
    discovered: crawlPaths.length,
    subdomains: subdomainCount,
    maxPages: cfg.maxPages,
  });

  const urls = discovered.map((t) => t.url);

  crawlEmit(onProgress, 'fetch', `جلب ${urls.length} صفحة (حد ${cfg.maxPages})…`, { count: urls.length });

  let fetchDone = 0;
  const fetchRetries = cfg.fetchRetries || 0;
  const fetchResults = await mapPool(urls, cfg.fetchConcurrency, async (url) => {
    let row;
    try {
      const html = await fetchHtmlWithRetry(url, fetchRetries);
      row = { url, path: indexedPath(url, base) || toPath(base, url), html, error: null };
    } catch (err) {
      console.warn('[crawl] skip', url, err.message);
      const blocked = /HTTP (401|403|406)/i.test(String(err.message || ''));
      row = {
        url,
        path: indexedPath(url, base) || toPath(base, url),
        html: null,
        error: err.message,
        errorText: formatFetchError(err, url),
        blocked,
      };
    }
    fetchDone += 1;
    crawlEmit(
      onProgress,
      'fetch',
      row.html
        ? `${fetchDone}/${urls.length} ${row.path} ✓`
        : `${fetchDone}/${urls.length} ${row.path} ✗ — ${row.errorText || row.error || 'فشل'}`,
      { path: row.path, ok: Boolean(row.html), error: row.errorText || row.error || undefined }
    );
    return row;
  });

  const fetchOk = fetchResults.filter((r) => r.html).length;
  const fetchFail = fetchResults.length - fetchOk;
  crawlEmit(
    onProgress,
    'fetch',
    `انتهى الجلب — ${fetchOk} ناجح${fetchFail ? `، ${fetchFail} فشل` : ''}`,
    { ok: fetchOk, failed: fetchFail }
  );
  if (fetchOk === 0 && fetchFail > 0) {
    const sampleErr =
      fetchResults.find((r) => r.errorText)?.errorText ||
      (homeFetchError ? formatFetchError(homeFetchError, base + '/') : 'تعذّر جلب أي صفحة');
    crawlEmit(onProgress, 'fetch', sampleErr, { allFailed: true });
  }

  const indexed = [];
  const browserCandidates = [];
  const emptyShell = {
    title: '',
    content: '',
    headings: [],
    links: [],
  };

  for (const row of fetchResults) {
    if (row.html) {
      let page = extractPage(row.html, row.url, extractOpts);
      page = enrichSpaShellPage(page, row.path);
      if (browserRender && needsBrowserRender(page, cfg, siteDefaultTitle)) {
        browserCandidates.push({ url: row.url, path: row.path, page, score: scorePageQuality(page, siteDefaultTitle) });
      } else {
        indexed.push({ url: row.url, path: row.path, ...page });
      }
      continue;
    }
    if (row.blocked && browserRender) {
      browserCandidates.push({
        url: row.url,
        path: row.path,
        page: { ...emptyShell, title: pathFallbackTitle(row.path) },
        score: -20,
      });
    }
  }

  browserCandidates.sort((a, b) => a.score - b.score);
  let browserPages = 0;
  let browserDisabled = false;
  const browserCap = cfg.browserAllThin
    ? Math.min(browserCandidates.length, Math.max(cfg.maxBrowserPages, 400))
    : cfg.maxBrowserPages;
  const browserLimit = browserCandidates.slice(0, browserCap);
  if (browserRender && browserLimit.length > 0) {
    crawlEmit(onProgress, 'browser', `محاكاة متصفح لـ ${browserLimit.length} صفحة…`);
  }
  for (const cand of browserLimit) {
    if (browserDisabled) {
      if (cand.page?.content) indexed.push({ url: cand.url, path: cand.path, ...cand.page });
      continue;
    }
    try {
      crawlEmit(onProgress, 'browser', `عرض ${cand.path}…`, { path: cand.path });
      const rendered = await browserRender(cand.url);
      const renderedPage = enrichSpaShellPage(
        extractPage(rendered, cand.url, extractOpts),
        cand.path
      );
      if (
        !isErrorShellPage(renderedPage) &&
        (scorePageQuality(renderedPage, siteDefaultTitle) > cand.score || !cand.page?.content)
      ) {
        indexed.push({ url: cand.url, path: cand.path, ...renderedPage });
        browserPages += 1;
        crawlEmit(onProgress, 'browser', `${cand.path} — تم ✓`, { path: cand.path });
        continue;
      }
    } catch (err) {
      if (!browserDisabled) {
        crawlEmit(onProgress, 'browser', `تعطيل المتصفح: ${err.message}`);
        browserDisabled = true;
      }
    }
    if (cand.page?.content) indexed.push({ url: cand.url, path: cand.path, ...cand.page });
  }

  for (const cand of browserCandidates.slice(browserCap)) {
    if (cand.page?.content) indexed.push({ url: cand.url, path: cand.path, ...cand.page });
  }

  const finalized = dedupeTitles(indexed, siteDefaultTitle);

  crawlEmit(onProgress, 'index', `حفظ ${finalized.length} صفحة في الفهرس…`);

  try {
    const { closeBrowser } = await import('./browserRenderer.js');
    await closeBrowser();
  } catch {
    /* optional */
  }

  // Keep /db/ rows from Supabase; replace all live HTML pages with this crawl.
  await query(
    `DELETE FROM indexed_pages WHERE website_id = $1 AND path NOT LIKE '/db/%'`,
    [websiteId]
  );

  for (const p of finalized) {
    await upsertIndexedPage(query, {
      tenantId,
      websiteId,
      url: p.url,
      path: p.path,
      title: p.title,
      content: p.content,
      headings: p.headings,
    });
  }

  const ms = Date.now() - t0;
  const summary = {
    pagesIndexed: finalized.length,
    routesDiscovered: crawlPaths.length,
    pathsCrawled: urls.length,
    pathsFailed: fetchFail,
    browserPages,
    baseUrl: base,
    inputUrl: normalizeBaseUrl(baseUrl),
    redirected,
    localDev,
    depth: cfg.id,
    depthLabel: cfg.labelAr,
    ms,
  };
  crawlEmit(
    onProgress,
    'web',
    `اكتمل زحف الويب — ${finalized.length} صفحة (${Math.round(ms / 1000)}ث)`,
    summary
  );

  return summary;
}

export async function listPages(websiteId) {
  const { rows } = await query(
    `SELECT id, url, path, title,
            left(content, 400) AS content_preview,
            length(content) AS content_length,
            COALESCE(excluded_from_ai, false) AS excluded_from_ai,
            COALESCE(jsonb_array_length(rag_chunks), 0) AS rag_chunk_count,
            crawled_at
       FROM indexed_pages
      WHERE website_id = $1 AND path NOT LIKE '/docs/%'
      ORDER BY path ASC`,
    [websiteId]
  );
  return rows;
}

export async function getPageById(websiteId, pageId) {
  const { rows } = await query(
    `SELECT id, url, path, title, content, headings, rag_chunks,
            length(content) AS content_length,
            COALESCE(excluded_from_ai, false) AS excluded_from_ai,
            crawled_at
       FROM indexed_pages
      WHERE website_id = $1 AND id = $2 AND path NOT LIKE '/docs/%'`,
    [websiteId, pageId]
  );
  return rows[0] || null;
}

export async function setPageAiVisibility(websiteId, pageId, excludedFromAi) {
  const { rows } = await query(
    `UPDATE indexed_pages
        SET excluded_from_ai = $3
      WHERE website_id = $1 AND id = $2 AND path NOT LIKE '/docs/%'
      RETURNING id, path, title, COALESCE(excluded_from_ai, false) AS excluded_from_ai`,
    [websiteId, pageId, Boolean(excludedFromAi)]
  );
  return rows[0] || null;
}

export async function getPageCount(websiteId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM indexed_pages
      WHERE website_id = $1 AND path NOT LIKE '/docs/%'`,
    [websiteId]
  );
  return rows[0]?.n || 0;
}
