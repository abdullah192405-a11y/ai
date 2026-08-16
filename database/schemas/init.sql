-- ═══════════════════════════════════════════════════════════
-- WBA Platform — Database Initialization
-- ═══════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Platform Admins (apps/admin — platform owner login) ──
CREATE TABLE platform_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tenants (subscriber accounts — created by admin) ────
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    settings        JSONB DEFAULT '{}',
    stripe_customer_id VARCHAR(255),
    created_by      UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Users (tenant dashboard login — email + password) ───
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    password_hash   VARCHAR(255),
    role            VARCHAR(50) NOT NULL DEFAULT 'tenant_owner',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE UNIQUE INDEX idx_users_email_global ON users (LOWER(email));

-- ─── Websites (domains added by user after login) ─────────
CREATE TABLE websites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain          VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255),
    verified        BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    auto_crawl      BOOLEAN NOT NULL DEFAULT FALSE,
    crawl_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
    settings        JSONB DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, domain)
);

-- ─── API Keys ────────────────────────────────────────────
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash        VARCHAR(64) NOT NULL UNIQUE,
    key_prefix      VARCHAR(20) NOT NULL,
    name            VARCHAR(255),
    scopes          TEXT[] DEFAULT '{"read:assistant"}',
    website_id      UUID REFERENCES websites(id) ON DELETE SET NULL,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Documents (Knowledge Base Sources) ──────────────────
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    website_id      UUID REFERENCES websites(id) ON DELETE SET NULL,
    title           VARCHAR(500),
    source_type     VARCHAR(50) NOT NULL,
    source_url      TEXT,
    file_path       TEXT,
    content_hash    VARCHAR(64),
    status          VARCHAR(20) DEFAULT 'pending',
    chunk_count     INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sessions (End User Conversations) ──────────────────
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    website_id      UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    visitor_id      VARCHAR(255),
    page_url        TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    message_count   INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}'
);

-- ─── Messages (Query/Response Pairs) ────────────────────
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    page_url        TEXT,
    tokens_used     INTEGER,
    model_used      VARCHAR(100),
    latency_ms      INTEGER,
    kb_chunks_used  JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Usage Records ──────────────────────────────────────
CREATE TABLE usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    query_count     INTEGER DEFAULT 0,
    token_count     BIGINT DEFAULT 0,
    document_count  INTEGER DEFAULT 0,
    storage_bytes   BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, period_start)
);

-- ─── Audit Logs ─────────────────────────────────────────
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),
    actor_type      VARCHAR(20) NOT NULL,
    actor_id        UUID,
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     UUID,
    ip_address      INET,
    user_agent      TEXT,
    result          VARCHAR(20) NOT NULL DEFAULT 'success',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Feature Flags ──────────────────────────────────────
CREATE TABLE feature_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    scope           VARCHAR(20) NOT NULL DEFAULT 'global',
    enabled         BOOLEAN DEFAULT FALSE,
    conditions      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

CREATE INDEX idx_platform_admins_email ON platform_admins(LOWER(email));
CREATE INDEX idx_tenants_created_by ON tenants(created_by);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_websites_tenant ON websites(tenant_id);
CREATE INDEX idx_websites_domain ON websites(domain);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE NOT revoked;
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX idx_sessions_tenant_active ON sessions(tenant_id, last_active_at);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_messages_tenant ON messages(tenant_id, created_at);
CREATE INDEX idx_usage_tenant_period ON usage_records(tenant_id, period_start);
CREATE INDEX idx_audit_tenant_action ON audit_logs(tenant_id, action, created_at);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Tenant isolation is enforced in platform-api (JWT + scoped queries).
-- RLS is disabled; see 006-disable-rls.sql for existing databases.
