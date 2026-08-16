/** Crawl depth presets — web pages first; Supabase is optional extra. */

export const CRAWL_DEPTHS = {
  fast: {
    id: 'fast',
    labelAr: 'سريع',
    hintAr: 'صفحات أساسية من HTML — ثوانٍ',
    maxPages: 80,
    maxBrowserPages: 0,
    maxBundles: 8,
    fetchConcurrency: 12,
    fetchRetries: 0,
    dbFullSync: false,
    dbUnlimited: false,
    followLinks: true,
    crawlSubdomains: false,
    maxSitemaps: 8,
    linkFollowRounds: 2,
    includeCatalogPaths: true,
  },
  medium: {
    id: 'medium',
    labelAr: 'متوسط',
    hintAr: 'sitemap + روابط + منتجات/مقالات + متصفح للصفحات الديناميكية (متاجر ومواقع)',
    maxPages: 500,
    maxBrowserPages: 80,
    maxBundles: 24,
    fetchConcurrency: 10,
    fetchRetries: 1,
    dbFullSync: true,
    dbUnlimited: false,
    followLinks: true,
    crawlSubdomains: true,
    maxSitemaps: 40,
    linkFollowRounds: 8,
    includeCatalogPaths: true,
  },
  deep: {
    id: 'deep',
    labelAr: 'عميق',
    hintAr: 'كل صفحات الموقع: HTML، متاجر، مقالات، نطاقات فرعية، متصفح للصفحات الديناميكية',
    maxPages: 12000,
    maxBrowserPages: 400,
    maxBundles: 120,
    fetchConcurrency: 12,
    fetchRetries: 2,
    dbFullSync: true,
    dbUnlimited: true,
    followLinks: true,
    crawlSubdomains: true,
    maxSitemaps: 250,
    browserAllThin: true,
    linkFollowRounds: 16,
    includeCatalogPaths: true,
  },
};

export function resolveCrawlDepth(raw) {
  const key = String(raw || 'deep').toLowerCase();
  return CRAWL_DEPTHS[key] || CRAWL_DEPTHS.deep;
}
