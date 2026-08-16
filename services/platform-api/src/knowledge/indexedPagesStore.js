import { buildRagChunks } from './pageChunks.js';

/** Upsert a page — refreshes content/chunks but keeps excluded_from_ai. */
export async function upsertIndexedPage(query, {
  tenantId,
  websiteId,
  url,
  path,
  title,
  content,
  headings,
}) {
  const headingArr = Array.isArray(headings) ? headings : [];
  const ragChunks = buildRagChunks({
    title,
    path,
    content,
    headings: headingArr,
  });

  await query(
    `INSERT INTO indexed_pages
       (tenant_id, website_id, url, path, title, content, headings, rag_chunks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (website_id, path) DO UPDATE SET
       url = EXCLUDED.url,
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       headings = EXCLUDED.headings,
       rag_chunks = EXCLUDED.rag_chunks,
       crawled_at = NOW()`,
    [
      tenantId,
      websiteId,
      url,
      path,
      title,
      content,
      JSON.stringify(headingArr),
      JSON.stringify(ragChunks),
    ]
  );
}
