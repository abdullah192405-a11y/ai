# 04 — Database Architecture

---

## 1. Multi-Tenancy Strategy

### Decision: **Shared Database, Row-Level Isolation with PostgreSQL RLS**

| Strategy | Pros | Cons | Verdict |
|----------|------|------|---------|
| Isolated DB per tenant | Strongest isolation | Expensive, hard to manage at scale | ❌ Not scalable for SaaS |
| Schema per tenant | Good isolation | Schema migration complexity | ❌ Operational burden |
| **Shared DB + RLS** | Cost-effective, scalable, manageable | Requires careful RLS policies | ✅ Best for this use case |

**Upgrade Path:** Enterprise tenants can opt for **dedicated database instances** as a premium feature.

### RLS Implementation
```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only see their own data
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Set tenant context per connection (done in service middleware)
SET app.current_tenant = 'tenant_abc123';
```

---

## 2. Core Entity Model

```
┌───────────────────────────────────────────────────────────────┐
│                     ENTITY RELATIONSHIPS                      │
│                                                               │
│  ┌──────────┐ 1    N ┌──────────┐ 1    N ┌──────────────┐    │
│  │  Tenant  │───────▶│ Website  │───────▶│  Document    │    │
│  │          │        │          │        │  (KB Source) │    │
│  └────┬─────┘        └──────────┘        └──────┬───────┘    │
│       │                                         │             │
│       │ 1    N                            1     │ N           │
│       │                                         ▼             │
│  ┌────▼─────┐                           ┌──────────────┐     │
│  │  User    │                           │   Chunk      │     │
│  │ (Member) │                           │ (Embedded)   │     │
│  └────┬─────┘                           └──────────────┘     │
│       │                                                       │
│       │ 1    N                                                │
│       ▼                                                       │
│  ┌──────────┐ 1    N ┌──────────────┐                        │
│  │ API Key  │       │  Session      │                        │
│  └──────────┘        │ (End User)   │                        │
│                      └──────┬───────┘                        │
│                             │ 1    N                         │
│                             ▼                                │
│                      ┌──────────────┐                        │
│                      │   Message    │                        │
│                      │ (Query/Resp) │                        │
│                      └──────────────┘                        │
└───────────────────────────────────────────────────────────────┘
```

### Table Definitions

```sql
-- Tenants (Website Owners / Organizations)
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, cancelled
    settings        JSONB DEFAULT '{}',
    stripe_customer_id VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Tenant Members)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255),
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Websites (Registered by Tenants)
CREATE TABLE websites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    domain          VARCHAR(255) NOT NULL,
    verified        BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    settings        JSONB DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, domain)
);

-- API Keys
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    key_hash        VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash
    key_prefix      VARCHAR(20) NOT NULL,        -- First 8 chars for identification
    name            VARCHAR(255),
    scopes          TEXT[] DEFAULT '{"read:assistant"}',
    website_id      UUID REFERENCES websites(id),
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Documents (Knowledge Base Sources)
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    website_id      UUID REFERENCES websites(id),
    title           VARCHAR(500),
    source_type     VARCHAR(50) NOT NULL, -- 'file', 'url', 'faq', 'text'
    source_url      TEXT,
    file_path       TEXT,                 -- S3 path
    content_hash    VARCHAR(64),          -- Detect duplicates
    status          VARCHAR(20) DEFAULT 'pending', -- pending, processing, indexed, failed
    chunk_count     INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (End User Conversations)
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    website_id      UUID NOT NULL REFERENCES websites(id),
    visitor_id      VARCHAR(255),          -- Anonymous fingerprint
    page_url        TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    message_count   INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}'
);

-- Messages (Query/Response Pairs)
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    role            VARCHAR(20) NOT NULL,  -- 'user', 'assistant'
    content         TEXT NOT NULL,
    page_url        TEXT,
    tokens_used     INTEGER,
    model_used      VARCHAR(100),
    latency_ms      INTEGER,
    kb_chunks_used  JSONB,                 -- References to chunks used
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Records (for Billing)
CREATE TABLE usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    query_count     INTEGER DEFAULT 0,
    token_count     BIGINT DEFAULT 0,
    document_count  INTEGER DEFAULT 0,
    storage_bytes   BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, period_start)
);

-- Indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_websites_tenant ON websites(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE NOT revoked;
CREATE INDEX idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX idx_sessions_tenant_active ON sessions(tenant_id, last_active_at);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_usage_tenant_period ON usage_records(tenant_id, period_start);
```

---

## 3. Vector Database Architecture

### Technology: **Qdrant** (self-hosted on K8s) or **Pinecone** (managed)

```
┌──────────────────────────────────────────────────┐
│              VECTOR DB STRUCTURE                 │
├──────────────────────────────────────────────────┤
│                                                  │
│  Collection: "knowledge_embeddings"              │
│                                                  │
│  Namespace Strategy: One namespace per tenant    │
│    └─ namespace: "tenant_{tenant_id}"            │
│                                                  │
│  Point Schema:                                   │
│  {                                               │
│    "id": "chunk_uuid",                           │
│    "vector": [0.123, -0.456, ...] (1536 dims),   │
│    "payload": {                                  │
│      "tenant_id": "t_abc123",                    │
│      "document_id": "doc_xyz",                   │
│      "website_id": "web_456",                    │
│      "source_url": "https://example.com/docs",   │
│      "chunk_index": 3,                           │
│      "chunk_text": "The actual text content...", │
│      "doc_type": "faq",                          │
│      "created_at": "2026-02-18T00:00:00Z"        │
│    }                                             │
│  }                                               │
│                                                  │
│  Indexes:                                        │
│  ├─ HNSW index on vectors (ef=128, m=16)         │
│  ├─ Payload index on tenant_id (keyword)         │
│  ├─ Payload index on source_url (keyword)        │
│  └─ Payload index on doc_type (keyword)          │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 4. Caching Layer (Redis Cluster)

```
┌──────────────────────────────────────────────────┐
│              REDIS CLUSTER TOPOLOGY              │
├──────────────────────────────────────────────────┤
│                                                  │
│  Cluster: 3 masters + 3 replicas (6 nodes)       │
│  Memory: 16GB per node                           │
│                                                  │
│  Keyspaces:                                      │
│  ├─ auth:*      → API key validation cache       │
│  ├─ session:*   → Conversation sessions          │
│  ├─ rl:*        → Rate limit counters            │
│  ├─ cache:resp:*→ Response cache                 │
│  ├─ cache:embed:*→ Embedding cache               │
│  ├─ flags:*     → Feature flag cache             │
│  └─ lock:*      → Distributed locks              │
│                                                  │
│  Eviction Policy: allkeys-lru                    │
│  Persistence: AOF (1s fsync) for sessions        │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 5. Object Storage (S3)

```
Bucket: wba-platform-{env}
├── tenants/
│   └── {tenant_id}/
│       ├── documents/
│       │   ├── {doc_id}/original.pdf
│       │   └── {doc_id}/extracted.txt
│       └── exports/
│           └── {export_id}.zip
├── system/
│   ├── models/
│   └── configs/
└── logs/
    └── audit/
        └── {date}/{tenant_id}.jsonl
```

---

*Continue to `05-API-ARCHITECTURE.md` →*
