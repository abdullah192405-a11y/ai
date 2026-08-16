# 03 — Dashboard & Admin Panel Architecture

---

## Repository Layout (Frontends)

| Path | Audience | Purpose |
|------|----------|---------|
| `apps/admin/` | **Platform owner** (you) | System monitoring, tenant management, feature flags, revenue |
| `apps/user/` | **Subscribers / tenants** | Knowledge base, API keys, analytics, billing, widget config |
| `apps/website/` | **Public visitors** | Marketing site, pricing, demo |
| `apps/widget/` | **End users on customer sites** | Embeddable AI assistant (served via `services/platform-api`) |

Backend counterparts: `services/admin-service` (platform ops API), tenant/auth/billing microservices for the subscriber dashboard.

---

## 1. Website Owner Dashboard Architecture

### Multi-Tenant Isolation Model

```
┌──────────────────────────────────────────────────────────┐
│                TENANT ISOLATION LAYERS                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: API Gateway                                    │
│  ├─ API key → tenant_id resolution                       │
│  └─ All requests tagged with tenant_id                   │
│                                                          │
│  Layer 2: Service Layer                                  │
│  ├─ Every query includes WHERE tenant_id = ?             │
│  ├─ Tenant context injected via middleware               │
│  └─ Cross-tenant access = hard error + alert             │
│                                                          │
│  Layer 3: Database (Row-Level Security)                  │
│  ├─ PostgreSQL RLS policies on all tenant tables         │
│  ├─ SET app.current_tenant = 'tenant_id' per connection  │
│  └─ RLS policy: USING (tenant_id = current_setting(...)) │
│                                                          │
│  Layer 4: Vector DB                                      │
│  ├─ Each tenant = separate namespace / collection        │
│  └─ Query always scoped to tenant namespace              │
│                                                          │
│  Layer 5: Object Storage (S3)                            │
│  ├─ Prefix: s3://bucket/{tenant_id}/documents/...        │
│  └─ IAM policies prevent cross-prefix access             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Role-Based Permissions (Tenant Level)

| Role | Permissions |
|------|------------|
| **Tenant Owner** | Full access: billing, API keys, members, knowledge, settings, analytics |
| **Tenant Admin** | Everything except billing & ownership transfer |
| **Tenant Editor** | Manage knowledge base, view analytics |
| **Tenant Viewer** | Read-only: view analytics, view knowledge sources |

### Dashboard API Interactions

```
Dashboard Backend (BFF - Backend for Frontend)
        │
        ├──▶ GET  /v1/tenants/{id}              → Tenant details
        ├──▶ GET  /v1/tenants/{id}/websites     → Registered websites
        ├──▶ POST /v1/tenants/{id}/websites     → Register website
        ├──▶ GET  /v1/tenants/{id}/api-keys     → List API keys
        ├──▶ POST /v1/tenants/{id}/api-keys     → Create API key
        ├──▶ DEL  /v1/tenants/{id}/api-keys/{k} → Revoke API key
        │
        ├──▶ POST /v1/knowledge/documents       → Upload document
        ├──▶ POST /v1/knowledge/urls             → Submit URL for crawling
        ├──▶ POST /v1/knowledge/faqs             → Add FAQ entries
        ├──▶ GET  /v1/knowledge/documents        → List documents
        ├──▶ DEL  /v1/knowledge/documents/{id}   → Delete document
        ├──▶ GET  /v1/knowledge/status            → Ingestion pipeline status
        │
        ├──▶ GET  /v1/analytics/queries          → Query volume & trends
        ├──▶ GET  /v1/analytics/topics           → Top user questions
        ├──▶ GET  /v1/analytics/gaps             → Unanswered questions
        ├──▶ GET  /v1/analytics/performance      → Latency & quality
        │
        ├──▶ GET  /v1/billing/usage              → Current usage
        ├──▶ GET  /v1/billing/invoices           → Invoice history
        └──▶ POST /v1/billing/upgrade            → Change plan
```

### Knowledge Management Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌───────────┐
│ Upload      │────▶│ Validation   │────▶│ Processing  │────▶│ Indexed   │
│ (Pending)   │     │ (Checking)   │     │ (Chunking + │     │ (Ready)   │
│             │     │              │     │  Embedding)  │     │           │
└─────────────┘     └──────────────┘     └─────────────┘     └───────────┘
                           │                    │
                     ┌─────▼─────┐        ┌─────▼─────┐
                     │ Rejected  │        │ Failed    │
                     │ (Invalid) │        │ (Retry)   │
                     └───────────┘        └───────────┘

Status tracking via WebSocket or polling:
  GET /v1/knowledge/documents/{id}/status
  → { status: "processing", progress: 65, chunks_created: 42 }
```

---

## 2. Admin Panel Architecture

### System Monitoring Dashboard

```
┌──────────────────────────────────────────────────────────┐
│              ADMIN MONITORING VIEWS                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  System Health                                           │
│  ├─ Service status (all microservices)                   │
│  ├─ Error rates (per service, per endpoint)              │
│  ├─ P50 / P95 / P99 latencies                            │
│  ├─ Active connections / open sessions                   │
│  └─ Queue depths (SQS)                                   │
│                                                          │
│  LLM Provider Health                                     │
│  ├─ Provider status (OpenAI, Anthropic, etc.)            │
│  ├─ Avg response time per provider                       │
│  ├─ Token consumption per provider                       │
│  ├─ Cost tracking (daily / monthly)                      │
│  └─ Circuit breaker states                               │
│                                                          │
│  Tenant Overview                                         │
│  ├─ Total tenants (active / inactive / trial)            │
│  ├─ Top tenants by usage                                 │
│  ├─ Tenants approaching quota limit                      │
│  └─ New signups (daily / weekly)                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Client Management
```
Admin Actions:
  ├─ View tenant details & usage
  ├─ Suspend / reactivate tenant
  ├─ Override tenant quota (temporary)
  ├─ Force API key rotation
  ├─ View tenant's query logs (with PII masking)
  ├─ Export tenant data (GDPR compliance)
  └─ Delete tenant data (right to erasure)
```

### Feature Flags System

```
┌──────────────────────────────────────────────────┐
│              FEATURE FLAGS                       │
├──────────────────────────────────────────────────┤
│  Flag                    │ Scope     │ State     │
├──────────────────────────┼───────────┼───────────┤
│  action_execution        │ Global    │ Enabled   │
│  streaming_responses     │ Global    │ Enabled   │
│  claude_model_access     │ Per-Plan  │ Pro+      │
│  custom_model_upload     │ Per-Tenant│ Disabled  │
│  advanced_analytics      │ Per-Plan  │ Pro+      │
│  webhook_notifications   │ Per-Plan  │ Starter+  │
│  multi_language_support  │ Global    │ Beta      │
│  self_hosted_models      │ Per-Tenant│ Enterprise│
└──────────────────────────┴───────────┴───────────┘

Implementation: LaunchDarkly or custom flags service (Redis-backed)
Evaluation: checked at API Gateway + service level
```

### Model Switching (Admin)
```
Admin can:
  ├─ Set default model per plan tier
  ├─ Override model for specific tenant
  ├─ A/B test models (route % of traffic to new model)
  ├─ Set fallback chains per model
  ├─ Disable a provider (maintenance mode)
  └─ View model comparison metrics (quality, latency, cost)
```

---

*Continue to `04-DATABASE-ARCHITECTURE.md` →*
