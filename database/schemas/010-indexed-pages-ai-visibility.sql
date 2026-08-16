-- Per-page AI visibility + precomputed RAG chunks for better retrieval.

ALTER TABLE indexed_pages
  ADD COLUMN IF NOT EXISTS excluded_from_ai BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE indexed_pages
  ADD COLUMN IF NOT EXISTS rag_chunks JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_indexed_pages_ai_visible
  ON indexed_pages(website_id)
  WHERE NOT excluded_from_ai;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS excluded_from_ai BOOLEAN NOT NULL DEFAULT false;
