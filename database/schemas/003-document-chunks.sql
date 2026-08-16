-- Text-only chunks from uploaded PDF/TXT (no URL paths in indexed_pages).

CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  website_id   UUID NOT NULL,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind         VARCHAR(20) DEFAULT 'section',
  title        VARCHAR(500),
  content      TEXT NOT NULL DEFAULT '',
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_website ON document_chunks(website_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id, sort_order);

-- Legacy uploads stored under /docs/ in indexed_pages are obsolete.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'indexed_pages'
  ) THEN
    DELETE FROM indexed_pages WHERE path LIKE '/docs/%';
  END IF;
END $$;
