import { query } from '../db.js';
import {
  LLM_KNOWLEDGE_BUDGET,
  LLM_PAGE_PICK_BROAD,
  LLM_PAGE_PICK_LIMIT,
  LLM_SITEMAP_LINES,
  LLM_SITEMAP_LINES_MINIMAL,
} from './knowledgeLimits.js';

function normalizeToken(w) {
  return String(w)
    .toLowerCase()
    .replace(/^ال/, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[\s,.;:!?،؟]+/)
    .map((w) => normalizeToken(w))
    .filter((w) => w.length > 1);
}

const ONBOARDING_HINTS = [
  'ابد', 'بدء', 'بدا', 'start', 'getting', 'welcome', 'home', 'guide', 'help', 'faq', 'about',
];

function scoreText(title, content, path, terms, { currentPath } = {}) {
  let score = 0;
  const titleNorm = normalizeToken(title || '');
  const contentNorm = normalizeToken(content || '');
  const pathLower = (path || '').toLowerCase();

  for (const term of terms) {
    if (titleNorm.includes(term)) score += 8;
    if (pathLower.includes(term)) score += 4;
    if (contentNorm.includes(term)) {
      score += 2 + Math.min(3, (contentNorm.match(new RegExp(term, 'g')) || []).length);
    }
  }

  if (currentPath && pathLower === currentPath) score += 12;
  if (pathLower === '/' || pathLower === '/home') score += 6;
  for (const hint of ONBOARDING_HINTS) {
    if (titleNorm.includes(hint) || pathLower.includes(hint)) score += 3;
  }
  return score;
}

function scorePage(page, terms, opts) {
  return scoreText(page.title, page.content, page.path, terms, opts);
}

function pageChunks(page) {
  const raw = page.rag_chunks;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((c, i) => ({
      id: c.id ?? String(i),
      title: c.title || page.title || page.path,
      text: c.text || '',
      kind: c.kind || 'section',
    }));
  }
  return [{ id: '0', title: page.title || page.path, text: page.content || '', kind: 'page' }];
}

function pickChunkHits(pages, terms, { currentPath, maxChunks = 14 } = {}) {
  const hits = [];
  for (const page of pages) {
    const baseScore = scorePage(page, terms, { currentPath });
    for (const chunk of pageChunks(page)) {
      const chunkScore = scoreText(chunk.title, chunk.text, page.path, terms, { currentPath });
      hits.push({
        path: page.path,
        url: page.url,
        pageTitle: page.title,
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        text: chunk.text,
        kind: chunk.kind,
        score: chunkScore + Math.max(0, baseScore * 0.35),
        headings: page.headings || [],
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, maxChunks);
}

function groupHitsByPage(hits) {
  const byPath = new Map();
  for (const hit of hits) {
    if (!byPath.has(hit.path)) {
      byPath.set(hit.path, {
        path: hit.path,
        url: hit.url,
        title: hit.pageTitle,
        score: hit.score,
        headings: hit.headings,
        chunks: [],
      });
    }
    const entry = byPath.get(hit.path);
    entry.score = Math.max(entry.score, hit.score);
    entry.chunks.push({
      id: hit.chunkId,
      title: hit.chunkTitle,
      text: hit.text,
      kind: hit.kind,
      score: hit.score,
    });
  }
  return [...byPath.values()].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function pathFromPageUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    return u.pathname + u.search;
  } catch {
    return '/';
  }
}

function buildSearchPatterns(terms) {
  const top = terms.slice(0, 4).filter((t) => t.length > 2);
  if (!top.length) return null;
  return top.map((t) => `%${t}%`);
}

// Keyword search over indexed pages — chunk-level retrieval for the LLM.
export async function searchPages({
  websiteId,
  question,
  pageUrl,
  limit = 5,
  routeQuestion = false,
  broadSearch = false,
  fullContent = true,
  includeAll = false,
} = {}) {
  const terms = tokenize(question);
  const currentPath = pathFromPageUrl(pageUrl);
  const patterns = buildSearchPatterns(terms);

  let rows;
  if (patterns?.length) {
    const { rows: filtered } = await query(
      `SELECT path, url, title, content, headings, rag_chunks
         FROM indexed_pages
        WHERE website_id = $1
          AND path NOT LIKE '/docs/%'
          AND COALESCE(excluded_from_ai, false) = false
          AND (
            title ILIKE ANY($2::text[])
            OR path ILIKE ANY($2::text[])
            OR content ILIKE ANY($2::text[])
          )
        ORDER BY path ASC
        LIMIT 400`,
      [websiteId, patterns]
    );
    rows = filtered;
    if (rows.length < 8) {
      const { rows: fallback } = await query(
        `SELECT path, url, title, content, headings, rag_chunks
           FROM indexed_pages
          WHERE website_id = $1
            AND path NOT LIKE '/docs/%'
            AND COALESCE(excluded_from_ai, false) = false
          ORDER BY path ASC
          LIMIT 600`,
        [websiteId]
      );
      const seen = new Set(rows.map((r) => r.path));
      for (const row of fallback) {
        if (!seen.has(row.path)) rows.push(row);
      }
    }
  } else {
    const { rows: all } = await query(
      `SELECT path, url, title, content, headings, rag_chunks
         FROM indexed_pages
        WHERE website_id = $1
          AND path NOT LIKE '/docs/%'
          AND COALESCE(excluded_from_ai, false) = false
        ORDER BY path ASC
        LIMIT 600`,
      [websiteId]
    );
    rows = all;
  }

  const { rows: mapRows } = await query(
    `SELECT path, title FROM indexed_pages
      WHERE website_id = $1
        AND path NOT LIKE '/docs/%'
        AND COALESCE(excluded_from_ai, false) = false
      ORDER BY path ASC`,
    [websiteId]
  );

  if (!rows.length) {
    return { pages: [], siteMap: mapRows, currentPath, allPages: [] };
  }

  const scored = rows
    .map((p) => ({ ...p, score: scorePage(p, terms, { currentPath }) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const pickLimit = includeAll
    ? rows.length
    : broadSearch || routeQuestion
      ? Math.max(limit, LLM_PAGE_PICK_BROAD)
      : Math.max(limit, LLM_PAGE_PICK_LIMIT);

  let pickedPaths = scored.slice(0, Math.min(pickLimit, scored.length));

  if (currentPath && !pickedPaths.some((p) => p.path === currentPath)) {
    const current = scored.find((p) => p.path === currentPath);
    if (current) pickedPaths = [current, ...pickedPaths.slice(0, pickLimit - 1)];
  }

  if (!scored[0]?.score && !pickedPaths.some((p) => p.path === '/')) {
    const home = scored.find((p) => p.path === '/');
    if (home && !pickedPaths.some((p) => p.path === home.path)) {
      pickedPaths = [...pickedPaths.slice(0, pickLimit - 1), home];
    }
  }

  const chunkHits = pickChunkHits(pickedPaths, terms, {
    currentPath,
    maxChunks: broadSearch || routeQuestion ? 18 : 12,
  });
  const grouped = groupHitsByPage(chunkHits);

  const top = grouped.map((p) => {
    const chunkText = p.chunks.map((c) => {
      const label = c.title && c.title !== p.title ? `### ${c.title}\n` : '';
      return `${label}${c.text}`.trim();
    }).join('\n\n');

    return {
      path: p.path,
      url: p.url,
      title: p.title,
      content: fullContent ? chunkText : chunkText.slice(0, 2000),
      headings: p.headings || [],
      score: p.score,
      chunks: p.chunks,
    };
  });

  return { pages: top, siteMap: mapRows, currentPath, allPages: rows };
}

/** Build LLM context — section chunks first, drop lowest-ranked pages if over budget. */
export function buildKnowledgeContext({
  pages,
  siteMap,
  currentPath,
  baseUrl,
  siteKnowledge,
  livePageContext,
  documentChunks = [],
  routeQuestion = false,
  budget = LLM_KNOWLEDGE_BUDGET,
  maxSiteMapLines = LLM_SITEMAP_LINES,
}) {
  const lines = [];

  if (siteKnowledge?.trim()) {
    lines.push('--- معلومات الموقع (من المالك) ---', siteKnowledge.trim(), '');
  }

  if (documentChunks?.length) {
    lines.push('--- مصادر مرفوعة (PDF/TXT) ---');
    for (const c of documentChunks) {
      const label =
        c.document_title && c.title !== c.document_title
          ? `${c.document_title} · ${c.title}`
          : c.title || c.document_title || 'مستند';
      lines.push(`\n### ${label}`);
      lines.push(String(c.content || ''));
    }
    lines.push('');
  }

  if (livePageContext?.visible_text || livePageContext?.title) {
    lines.push('--- الصفحة الحالية (نص حي من المتصفح) ---');
    if (livePageContext.title) lines.push(`العنوان: ${livePageContext.title}`);
    if (livePageContext.description) lines.push(`الوصف: ${livePageContext.description}`);
    if (livePageContext.visible_text) lines.push(String(livePageContext.visible_text));
    lines.push('');
  }

  if (!pages.length) {
    lines.push(
      documentChunks?.length
        ? 'لا توجد صفحات ويب مفهرسة — الإجابة من المصادر المرفوعة و/أو النص الحي.'
        : 'لا توجد صفحات مفهرسة بعد. استخدم النص الحي أعلاه و/أو معلومات المالك.',
      `الموقع: ${baseUrl}`,
      `المسار الحالي: ${currentPath}`
    );
    return lines.join('\n');
  }

  const mapLines = siteMap.map((p) => `- ${p.path} : ${p.title || '(بدون عنوان)'}`);
  const mapCap = maxSiteMapLines > 0 ? maxSiteMapLines : mapLines.length;
  const mapShown = mapLines.slice(0, mapCap);
  const mapOmitted = mapLines.length - mapShown.length;

  const header = [
    `الموقع الأساسي: ${baseUrl}`,
    `مسار الصفحة الحالية: ${currentPath}`,
    '',
    `--- خريطة الصفحات (للتنقل${mapOmitted ? ` — ${mapLines.length} مسار في الفهرس` : ''}) ---`,
    ...mapShown,
    ...(mapOmitted
      ? [`(... ${mapOmitted} مسار إضافي — اسأل عن صفحة محددة أو استخدم «أين أجد ...»)`]
      : []),
    '',
    '--- مقاطع المحتوى (الأكثر صلة بالسؤال) ---',
  ];

  const sorted = [...pages].sort((a, b) => (b.score || 0) - (a.score || 0));
  const pageBlocks = [];
  let omitted = 0;

  for (const p of sorted) {
    const block = [`\n## ${p.title || p.path} (${p.path})`];

    if (p.chunks?.length) {
      for (const c of p.chunks) {
        if (c.title && c.title !== p.title) block.push(`\n### ${c.title}`);
        block.push(String(c.text || ''));
      }
    } else {
      block.push(String(p.content || ''));
    }

    const ids = (p.headings || []).filter((h) => h.selector);
    if (ids.length) {
      block.push('عناوين/أقسام:', ...ids.map((h) => `- ${h.text} → ${h.selector}`));
    }

    const blockText = block.join('\n');
    const currentLen = header.join('\n').length + pageBlocks.join('\n\n').length;
    if (currentLen + blockText.length > budget && pageBlocks.length > 0) {
      omitted += 1;
      continue;
    }
    pageBlocks.push(blockText);
  }

  if (omitted > 0) {
    header.push(
      `(تنبيه: ${omitted} صفحة إضافية في الفهرس — أضف كلمات من سؤالك لتضييق النتائج)`
    );
  }

  return [...header, ...pageBlocks].join('\n');
}
