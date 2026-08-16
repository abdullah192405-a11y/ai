-- Background crawl jobs — let a site crawl run server-side and survive the user
-- leaving the dashboard page. Progress logs + summary are persisted so the UI can
-- reconnect and resume showing live progress on reload.

CREATE TABLE IF NOT EXISTS crawl_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    website_id    UUID NOT NULL,
    base_url      TEXT NOT NULL,
    depth         VARCHAR(20) NOT NULL DEFAULT 'medium',
    status        VARCHAR(20) NOT NULL DEFAULT 'running', -- running | completed | failed | canceled
    phase         VARCHAR(40),
    logs          JSONB NOT NULL DEFAULT '[]',
    summary       JSONB,
    error         TEXT,
    pages_indexed INTEGER NOT NULL DEFAULT 0,
    log_seq       INTEGER NOT NULL DEFAULT 0,
    cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_website ON crawl_jobs(website_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);
