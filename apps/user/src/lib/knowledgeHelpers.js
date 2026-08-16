/** Helpers for the knowledge base dashboard page. */

export const CRAWL_DEPTH_OPTIONS = [
  { id: 'fast', label: 'سريع', hint: 'صفحات HTML أساسية — ثوانٍ' },
  { id: 'medium', label: 'متوسط', hint: 'sitemap + روابط + منتجات ومقالات + متصفح' },
  { id: 'deep', label: 'عميق', hint: 'كل صفحات الموقع والمتجر: منتجات، مقالات، أسئلة، أسعار' },
];

export function detectSiteType(baseUrl, supabaseSchema) {
  const isCarSite =
    supabaseSchema === 'cars' || /:3000\b|max.?motor|motors|سيارات/i.test(baseUrl);
  const isEducationSite =
    supabaseSchema === 'education' || /:8081\b|acme|تعليم|education/i.test(baseUrl);
  return { isCarSite, isEducationSite };
}

export function getSupabaseHelpText({ isCarSite, isEducationSite }) {
  if (isCarSite) {
    return 'موقع السيارات: أضف Supabase URL و anon key ليقرأ البوت السيارات والبنوك مباشرة من قاعدة البيانات.';
  }
  if (isEducationSite) {
    return 'موقع التعليم (localhost:8081): الزحف العميق يكتشف Supabase تلقائياً من الموقع — أو أضف URL و anon key يدوياً للمزامنة المباشرة.';
  }
  return 'كل موقع له Supabase خاص — أضف URL و anon key من Supabase → Settings → API لهذا الموقع فقط.';
}

export function formatSupabaseStats(sb) {
  if (!sb?.configured) return null;
  if (sb.schema === 'cars') {
    const s = sb.stats || {};
    return `متصل — ${sb.total} سجل (${s.cars || 0} سيارة، ${s.banks || 0} بنك)`;
  }
  if (sb.schema === 'education') {
    const s = sb.stats || {};
    const parts = [
      s.organizations ? `${s.organizations} مؤسسة` : null,
      s.grades ? `${s.grades} صف` : null,
      s.topics ? `${s.topics} موضوع` : null,
      s.subjects ? `${s.subjects} مادة` : null,
    ].filter(Boolean);
    return `متصل — ${sb.total} سجل${parts.length ? ` (${parts.join('، ')})` : ''}`;
  }
  return `متصل — ${sb.total} سجل`;
}

export function buildCrawlSummaryMessage(res, fallbackUrl) {
  const dbPart = res.dbRecordsSynced ? ` + ${res.dbRecordsSynced} سجل قاعدة بيانات` : '';
  const routesPart = res.routesDiscovered
    ? ` (${res.routesDiscovered} مسار مكتشف، ${res.pagesIndexed} صفحة HTML مفهرسة)`
    : '';
  const redirectPart = res.redirected && res.inputUrl
    ? ` — تم التوجيه تلقائياً من ${res.inputUrl}`
    : '';
  const browserPart = res.browserPages ? ` (${res.browserPages} صفحة بمحاكي المتصفح)` : '';
  const depthPart = res.depthLabel ? ` (${res.depthLabel})` : '';
  const localHint = /localhost|127\.0\.0\.1/i.test(res.baseUrl || fallbackUrl || '')
    ? ' — تأكد أن خادم التطوير للموقع يعمل (مثال: npm run dev -- --port 8081)'
    : '';
  if ((res.pagesIndexed ?? 0) === 0 && (res.pathsCrawled ?? 0) > 0) {
    return `فشل الزحف — 0 صفحة مفهرسة${depthPart}${routesPart}${localHint}`;
  }
  return `تم فهرسة ${res.pagesIndexed} صفحة من الموقع${depthPart}${routesPart}${dbPart}${browserPart} — الإجمالي ${res.routesSynced ?? res.pagesIndexed} سجل من ${res.baseUrl}${redirectPart}`;
}

export function isSuccessMessage(message) {
  return message.includes('تم') && !message.startsWith('فشل');
}
