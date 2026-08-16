const ROUTES_HEADER = 'الصفحات (مسارات هذا الموقع):';

function stripManagedBlocks(text = '') {
  let t = String(text || '').trim();
  const routesIdx = t.indexOf(ROUTES_HEADER);
  if (routesIdx >= 0) {
    const end = t.indexOf('\n--- ', routesIdx + ROUTES_HEADER.length);
    const tail = end >= 0 ? t.slice(end).trimStart() : '';
    t = `${t.slice(0, routesIdx).trimEnd()}${tail ? `\n\n${tail}` : ''}`.trim();
  }
  const legacyContent = '--- ملخص محتوى الصفحات (من الزحف) ---';
  const legacyIdx = t.indexOf(legacyContent);
  if (legacyIdx >= 0) {
    const rest = t.slice(legacyIdx + legacyContent.length);
    const nextSection = rest.search(/\n--- [^\n]+/);
    const tail = nextSection >= 0 ? rest.slice(nextSection).trimStart() : '';
    t = `${t.slice(0, legacyIdx).trimEnd()}${tail ? `\n\n${tail}` : ''}`.trim();
  }
  return t;
}

/** Refresh route list in siteKnowledge. Full page text lives in indexed_pages (sent whole to the LLM). */
export function buildSiteKnowledgeFromPages(pages, existingText = '') {
  const sorted = [...pages].sort((a, b) => a.path.localeCompare(b.path));
  const routeLines = sorted.map((p) => {
    const title = (p.title || '').trim();
    return title ? `- ${p.path} — ${title}` : `- ${p.path}`;
  });

  const routesBlock = [ROUTES_HEADER, ...routeLines].join('\n');
  const preserved = stripManagedBlocks(existingText);
  const intro =
    preserved ||
    'خريطة مسارات الموقع. النص الكامل لكل صفحة مفهرس في قاعدة المعرفة ويُرسل للبوت.';
  return `${intro}\n\n${routesBlock}`.trim();
}

/** @deprecated full text is in indexed_pages — kept for callers that expect an excerpt helper */
export function pageContentExcerpt(content, maxLen = 500000) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}
