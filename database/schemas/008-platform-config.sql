-- Platform-wide config (AI provider keys, etc.) — editable from admin dashboard
CREATE TABLE IF NOT EXISTS platform_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_by  UUID REFERENCES platform_admins(id) ON DELETE SET NULL
);
