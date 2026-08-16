-- ═══════════════════════════════════════════════════════════
-- WBA Platform — MVP: Admin creates user → user adds domain
-- Run after init.sql (idempotent where possible)
-- ═══════════════════════════════════════════════════════════

-- ─── Platform Admins (apps/admin login) ─────────────────
-- Separate from tenant users. Only platform owner(s) use this.
CREATE TABLE IF NOT EXISTS platform_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tenants: track who created the account ───────────────
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES platform_admins(id) ON DELETE SET NULL;

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── Users: display name + globally unique login email ────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Login uses email alone (no tenant context), so email must be unique platform-wide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_global ON users (LOWER(email));

-- Normalize legacy role value from seed script
UPDATE users SET role = 'tenant_owner' WHERE role = 'owner';

-- ─── Websites: friendly name + crawl prefs (user dashboard) ─
ALTER TABLE websites
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

ALTER TABLE websites
    ADD COLUMN IF NOT EXISTS auto_crawl BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE websites
    ADD COLUMN IF NOT EXISTS crawl_frequency VARCHAR(20) NOT NULL DEFAULT 'daily';

-- ─── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(LOWER(email));

-- ─── RLS (platform_admins: service-role / backend only) ───
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- No policies on platform_admins: only backend with service credentials accesses it.
