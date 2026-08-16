-- Indexed web pages for knowledge base crawling (moved from runtime ensureSchema).

CREATE TABLE IF NOT EXISTS indexed_pages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    website_id  UUID NOT NULL,
    url         TEXT NOT NULL,
    path        TEXT NOT NULL,
    title       TEXT,
    content     TEXT NOT NULL DEFAULT '',
    headings    JSONB DEFAULT '[]',
    crawled_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(website_id, path)
);

CREATE INDEX IF NOT EXISTS idx_indexed_pages_website ON indexed_pages(website_id);
