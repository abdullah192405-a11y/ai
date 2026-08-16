-- Widget message feedback ratings.

CREATE TABLE IF NOT EXISTS message_feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID,
    tenant_id   UUID,
    rating      VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
