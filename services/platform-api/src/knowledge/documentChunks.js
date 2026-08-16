/** Text-only knowledge from uploaded PDFs/TXT — no web paths. */

import { query } from '../db.js';

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

function scoreChunk(chunk, terms) {
  let score = 0;
  const title = normalizeToken(chunk.title || '');
  const content = normalizeToken(chunk.content || '');
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (content.includes(term)) score += 2 + Math.min(3, (content.match(new RegExp(term, 'g')) || []).length);
  }
  return score;
}

export async function ensureDocumentChunksTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id    UUID NOT NULL,
      website_id   UUID NOT NULL,
      document_id  UUID NOT NULL,
      kind         VARCHAR(20) DEFAULT 'section',
      title        VARCHAR(500),
      content      TEXT NOT NULL DEFAULT '',
      sort_order   INT DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_document_chunks_website ON document_chunks(website_id);
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id, sort_order);
  `);
  await query(`DELETE FROM indexed_pages WHERE path LIKE '/docs/%'`);
}

/** Remove legacy /docs/… entries from indexed_pages (old model). */
export async function purgeLegacyDocPaths(websiteId) {
  await query(
    `DELETE FROM indexed_pages WHERE website_id = $1 AND path LIKE '/docs/%'`,
    [websiteId]
  );
}

export async function saveDocumentChunks({
  tenantId,
  websiteId,
  documentId,
  documentTitle,
  summary,
  sections,
}) {
  await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
  await purgeLegacyDocPaths(websiteId);

  let sortOrder = 0;
  let count = 0;

  if (summary?.trim()) {
    await query(
      `INSERT INTO document_chunks (tenant_id, website_id, document_id, kind, title, content, sort_order)
       VALUES ($1, $2, $3, 'summary', $4, $5, $6)`,
      [tenantId, websiteId, documentId, documentTitle, summary.trim(), sortOrder]
    );
    sortOrder += 1;
    count += 1;
  }

  for (const sec of sections) {
    if (!sec?.content?.trim()) continue;
    await query(
      `INSERT INTO document_chunks (tenant_id, website_id, document_id, kind, title, content, sort_order)
       VALUES ($1, $2, $3, 'section', $4, $5, $6)`,
      [tenantId, websiteId, documentId, sec.title || documentTitle, sec.content.trim(), sortOrder]
    );
    sortOrder += 1;
    count += 1;
  }

  return count;
}

export async function deleteDocumentChunks(documentId, websiteId) {
  await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
  await purgeLegacyDocPaths(websiteId);
}

export async function getDocumentExtractedKnowledge(websiteId, documentId) {
  const { rows: docRows } = await query(
    `SELECT id, title, source_type, status, chunk_count, metadata, created_at, error_message
       FROM documents WHERE id = $1 AND website_id = $2`,
    [documentId, websiteId]
  );
  const document = docRows[0];
  if (!document) return null;

  let { rows: chunks } = await query(
    `SELECT id, kind, title, content, length(content)::int AS content_length, sort_order, created_at
       FROM document_chunks
      WHERE document_id = $1
      ORDER BY sort_order ASC`,
    [documentId]
  );

  if (!chunks.length) {
    chunks = await migrateLegacyChunksFromIndexedPages(websiteId, documentId, document.title);
  }

  return { document, chunks };
}

async function migrateLegacyChunksFromIndexedPages(websiteId, documentId, documentTitle) {
  const base = `/docs/${documentId}`;
  const { rows } = await query(
    `SELECT title, content, path FROM indexed_pages
      WHERE website_id = $1 AND (path = $2 OR path LIKE $3)
      ORDER BY path ASC`,
    [websiteId, base, `${base}/%`]
  );
  if (!rows.length) return [];

  return rows.map((r, i) => ({
    id: `legacy-${i}`,
    kind: r.path === base ? 'summary' : 'section',
    title: r.title || documentTitle,
    content: r.content,
    content_length: String(r.content || '').length,
    sort_order: i,
    created_at: null,
  }));
}

export async function searchDocumentChunks(websiteId, question, { limit = 6 } = {}) {
  const { rows } = await query(
    `SELECT dc.id, dc.kind, dc.title, dc.content, dc.document_id, d.title AS document_title
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
      WHERE dc.website_id = $1
        AND d.status = 'indexed'
        AND COALESCE(d.excluded_from_ai, false) = false
      ORDER BY dc.sort_order ASC`,
    [websiteId]
  );
  if (!rows.length) return [];

  const terms = tokenize(question);
  if (!terms.length) return rows.slice(0, limit);

  return rows
    .map((c) => ({
      ...c,
      score: scoreChunk(c, terms),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** All chunks for a website (context when question is broad). */
export async function listDocumentChunksForContext(websiteId, { limit = 8 } = {}) {
  const { rows } = await query(
    `SELECT dc.id, dc.kind, dc.title, dc.content, d.title AS document_title
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
      WHERE dc.website_id = $1
        AND d.status = 'indexed'
        AND COALESCE(d.excluded_from_ai, false) = false
      ORDER BY d.created_at DESC, dc.sort_order ASC
      LIMIT $2`,
    [websiteId, limit]
  );
  return rows;
}

export function formatDocumentChunksForPrompt(chunks) {
  if (!chunks?.length) return '';
  const lines = ['--- مصادر مرفوعة (نصوص — بدون مسارات URL) ---'];
  for (const c of chunks) {
    const label = c.document_title && c.title !== c.document_title
      ? `${c.document_title} · ${c.title}`
      : c.title || c.document_title || 'مستند';
    lines.push(`\n### ${label}`);
    lines.push(String(c.content || ''));
  }
  return lines.join('\n');
}
