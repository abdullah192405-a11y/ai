# 01 — Core Platform Services

---

## 1. Authentication & Authorization Service

### Responsibilities
- Website Owner registration & login (email/password, OAuth2 SSO)
- API key generation, rotation, and revocation
- JWT issuance & validation (RS256, short-lived access + long-lived refresh)
- End-user session tokens (anonymous, scoped to tenant)
- RBAC enforcement (Platform Admin, Tenant Admin, Tenant Member)

### Architecture

```
┌──────────────────────────────────────────────────┐
│               AUTH SERVICE                       │
├──────────────────────────────────────────────────┤
│  /auth/register       → Create tenant account    │
│  /auth/login          → Issue JWT pair           │
│  /auth/refresh        → Rotate access token      │
│  /auth/api-keys       → CRUD API keys            │
│  /auth/api-keys/verify→ Validate incoming key    │
│  /auth/roles          → Role assignment          │
└──────────────────────────────────────────────────┘
         │                          │
    ┌────▼────┐              ┌──────▼──────┐
    │ Users   │              │ API Keys    │
    │ Table   │              │ Table       │
    │ (PG)    │              │ (PG+Redis)  │
    └─────────┘              └─────────────┘
```

### API Key Design
```
Format:  wba_live_<tenant_id_hash>_<random_32_bytes_base62>
Example: wba_live_t8f2k_a3Bx9mZ7qR4wP1nL6hJ8cF0vD5sY2eK

Storage: SHA-256 hash stored in DB (never store plaintext)
Cache:   Hash → tenant_id mapping cached in Redis (TTL: 5 min)
Scopes:  read:assistant, write:knowledge, admin:tenant
```

### JWT Token Structure
```json
{
  "sub": "user_id",
  "tenant_id": "tenant_abc123",
  "role": "tenant_admin",
  "scopes": ["read:assistant", "write:knowledge"],
  "iss": "wba-auth",
  "exp": 1708300800,
  "iat": 1708297200
}
```

---

## 2. Subscription & Billing Service

### Responsibilities
- Plan management (Free, Starter, Pro, Enterprise)
- Usage metering (queries, documents, tokens consumed)
- Stripe integration for payments
- Invoice generation
- Overage handling & notifications
- Trial management

### Plan Tiers

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Websites | 1 | 3 | 10 | Unlimited |
| Queries/month | 1,000 | 10,000 | 100,000 | Custom |
| KB Documents | 50 | 500 | 5,000 | Unlimited |
| KB Size | 10 MB | 100 MB | 1 GB | Custom |
| Models | GPT-4o-mini | GPT-4o | All | Custom/Self-hosted |
| Support | Community | Email | Priority | Dedicated |
| Analytics | Basic | Standard | Advanced | Custom |
| API Rate Limit | 10 req/min | 60 req/min | 300 req/min | Custom |

### Metering Pipeline

```
End User Query
      │
      ▼
┌─────────────┐    Event     ┌────────────────┐    Aggregate    ┌─────────────┐
│ AI Service  │───────────▶  │ Event Queue    │──────────────▶  │ Metering    │
│             │  (async)     │ (SQS)          │   (5-min)       │ Aggregator  │
└─────────────┘              └────────────────┘                 └──────┬──────┘
                                                                       │
                                                                ┌──────▼──────┐
                                                                │ Usage DB    │
                                                                │ (TimescaleDB│
                                                                │  or PG)     │
                                                                └──────┬──────┘
                                                                       │
                                                              ┌────────▼────────┐
                                                              │ Billing Check   │
                                                              │ (Threshold      │
                                                              │  alerts)        │
                                                              └─────────────────┘
```

---

## 3. API Gateway

### Responsibilities
- Single entry point for all external traffic
- Request routing to backend services
- Rate limiting enforcement (per API key + per IP)
- Request/response transformation
- API versioning routing
- TLS termination
- Request correlation ID injection

### Technology: **Kong Gateway** (or AWS API Gateway + Lambda Authorizer)

### Routing Table

```
/v1/auth/*           →  Auth Service
/v1/tenants/*        →  Tenant Management Service
/v1/billing/*        →  Billing Service
/v1/knowledge/*      →  Knowledge Base Service
/v1/assistant/query  →  AI Orchestration Service
/v1/analytics/*      →  Analytics Service
/v1/admin/*          →  Admin Service (internal)
```

### Rate Limiting Strategy

```
Layer 1 — Global:      10,000 req/s across all tenants
Layer 2 — Per Tenant:  Based on subscription tier
Layer 3 — Per API Key: Subset of tenant limit
Layer 4 — Per IP:      100 req/min (end-user abuse prevention)

Algorithm: Sliding window counter (Redis-backed)
Headers:  X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

---

## 4. Tenant Management Service

### Responsibilities
- Website registration & configuration
- Domain verification (DNS TXT record or meta tag)
- Tenant settings management
- API key lifecycle (delegates to Auth Service)
- Tenant onboarding workflow orchestration

### Domain Verification Flow

```
1. Tenant registers website domain: example.com
2. System generates verification token: wba-verify=abc123xyz
3. Tenant adds DNS TXT record OR meta tag to their site
4. System runs async verification job (retry 3x over 24h)
5. On success: domain is marked verified, assistant is activated
6. On failure: notification sent, manual verification option
```

### Tenant Configuration Schema
```json
{
  "tenant_id": "t_abc123",
  "domain": "example.com",
  "verified": true,
  "settings": {
    "assistant_name": "ExampleBot",
    "welcome_message": "Hi! How can I help you navigate?",
    "theme": { "primary_color": "#4F46E5" },
    "allowed_origins": ["https://example.com", "https://www.example.com"],
    "model_preference": "gpt-4o",
    "max_conversation_turns": 20,
    "actions_enabled": true,
    "allowed_actions": ["navigate", "scroll", "highlight"]
  },
  "status": "active",
  "plan": "pro"
}
```

---

## 5. Analytics & Monitoring Service

### Responsibilities
- Query volume tracking per tenant
- Response quality metrics (latency, relevance scores)
- User engagement analytics (session length, follow-up rate)
- Knowledge base coverage gaps detection
- System health dashboards
- Alerting on anomalies

### Metrics Pipeline

```
Services emit events
        │
        ▼
  ┌───────────┐     ┌──────────────┐     ┌────────────────┐
  │ Event Bus │────▶│ Stream       │────▶│ Time-Series DB │
  │ (SNS/SQS) │     │ Processor    │     │ (TimescaleDB / │
  └───────────┘     │ (Lambda/ECS) │     │  InfluxDB)     │
                    └──────────────┘     └────────┬───────┘
                                                  │
                                          ┌───────▼───────┐
                                          │ Dashboard API │
                                          │ (Grafana /    │
                                          │  Custom)      │
                                          └───────────────┘
```

### Key Metrics

| Metric | Granularity | Retention |
|--------|------------|-----------|
| Query count | Per minute | 90 days |
| Avg response latency | Per minute | 90 days |
| Token usage | Per query | 1 year |
| KB retrieval hit rate | Per hour | 90 days |
| Error rate | Per minute | 1 year |
| Active sessions | Real-time | 30 days |
| Knowledge gap queries | Per query | Indefinite |

---

*Continue to `02-AI-AGENT-ARCHITECTURE.md` →*
