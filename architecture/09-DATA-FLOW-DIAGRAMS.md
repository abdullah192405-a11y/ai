# 09 — End-to-End Data Flow Diagrams

---

## 1. End User Query Flow (Primary Data Flow)

```
Step  Actor/Component          Action
────  ──────────────────────   ─────────────────────────────────────

 1    End User                 Types question in Chrome extension / embedded widget
                               on page: https://example.com/pricing

 2    Client Widget            Sends POST /v1/assistant/query
                               Headers: X-API-Key: wba_live_t8f2k_...
                               Body: {
                                 "domain": "example.com",
                                 "page_url": "https://example.com/pricing",
                                 "question": "What's included in the Pro plan?",
                                 "session_id": "sess_abc123"
                               }

 3    Cloudflare (Edge)        DDoS check → WAF rules → Pass to origin

 4    API Gateway              ├─ Extract X-API-Key
                               ├─ Hash key → lookup in Redis cache
                               ├─ Cache MISS → query Auth Service → cache result
                               ├─ Validate: key active, origin allowed, scope valid
                               ├─ Check rate limit (sliding window in Redis)
                               ├─ Inject: X-Tenant-ID, X-Request-ID, X-Correlation-ID
                               └─ Route to AI Orchestration Service

 5    AI Orchestration         ├─ Load session from Redis (conversation history)
                               ├─ Check response cache: hash(tenant + url + question)
                               │   └─ Cache HIT → skip to Step 10
                               ├─ Build context object:
                               │   { domain, page_url, conversation_history, question }
                               └─ Call Knowledge Base Service (Step 6)

 6    Knowledge Base Service   ├─ Embed question using text-embedding-3-large
                               ├─ Query Qdrant: namespace="tenant_t8f2k"
                               │   ├─ top_k=20, score_threshold=0.72
                               │   └─ boost: source_url matches current page_url
                               ├─ Rerank results using cross-encoder (top 5)
                               └─ Return ranked knowledge chunks

 7    AI Orchestration         ├─ Construct prompt:
                               │   ├─ System prompt (role, rules, constraints)
                               │   ├─ Context (domain, URL, page info)
                               │   ├─ Knowledge chunks (from Step 6)
                               │   ├─ Conversation history (last 10 turns)
                               │   └─ User question
                               └─ Call LLM Gateway (Step 8)

 8    LLM Gateway              ├─ Select model (tenant preference: gpt-4o)
                               ├─ Call OpenAI API (streaming)
                               ├─ If timeout/error → circuit breaker → fallback model
                               ├─ Count tokens (input + output)
                               └─ Stream response tokens back

 9    AI Orchestration         ├─ Receive streamed response
                               ├─ Validate output safety (content filter)
                               ├─ Extract action suggestions (if any)
                               ├─ Cache response (TTL: 15 min)
                               ├─ Update session in Redis
                               ├─ Emit usage event to SQS (async):
                               │   { tenant_id, tokens, model, latency }
                               └─ Return response (Step 10)

10    API Gateway              ├─ Add response headers (X-Request-ID, rate limit info)
                               └─ Forward to client

11    Client Widget            ├─ Display response to end user
                               ├─ If actions suggested: show approval prompt
                               └─ User can approve/reject actions

12    Async Workers            ├─ Usage Aggregator: increment counters → check quota
      (Background)             ├─ Analytics: record query metrics
                               └─ Audit Logger: log event to S3
```

---

## 2. Knowledge Ingestion Flow

```
Step  Actor/Component          Action
────  ──────────────────────   ─────────────────────────────────────

 1    Website Owner            Uploads PDF via dashboard
                               POST /v1/knowledge/documents
                               Body: { file, website_id, title }

 2    API Gateway              Authenticate JWT → verify tenant → route

 3    Knowledge Base Service   ├─ Validate file (type, size, tenant quota)
                               ├─ Upload file to S3: tenants/{id}/documents/{doc}/original.pdf
                               ├─ Create document record in PostgreSQL (status: pending)
                               └─ Enqueue job to SQS: document-ingestion queue

 4    Ingestion Worker         ├─ Dequeue message from SQS
      (Async)                  ├─ Download file from S3
                               ├─ Extract text (Apache Tika / pdfplumber)
                               ├─ Update status: "processing"
                               ├─ Chunk text:
                               │   ├─ Strategy: recursive character splitter
                               │   ├─ Chunk size: 512 tokens, overlap: 64 tokens
                               │   └─ Preserve metadata (page number, section)
                               ├─ Embed chunks (batch of 100):
                               │   └─ Model: text-embedding-3-large (1536 dims)
                               ├─ Upsert to Qdrant:
                               │   ├─ Namespace: tenant_{tenant_id}
                               │   └─ Payload: {doc_id, source_url, chunk_index, text}
                               ├─ Update PostgreSQL: status="indexed", chunk_count=N
                               └─ Emit event: knowledge.document.indexed

 5    Notification             ├─ If webhook subscribed: deliver webhook
      (Async)                  └─ Dashboard polling shows: ✅ Indexed (42 chunks)

Error Handling:
  ├─ Extraction failure → status="failed", retry 2x, then alert
  ├─ Embedding failure → retry individual batch, DLQ on persistent failure
  └─ Qdrant failure → retry with backoff, alert if Qdrant is down
```

---

## 3. Website Owner Onboarding Flow

```
Step  Actor/Component          Action
────  ──────────────────────   ─────────────────────────────────────

 1    Website Owner            Signs up: POST /v1/auth/register
                               Body: { email, password, org_name }

 2    Auth Service             ├─ Validate email uniqueness
                               ├─ Hash password (Argon2id)
                               ├─ Create tenant record
                               ├─ Create user record (role: owner)
                               ├─ Send verification email
                               └─ Return JWT pair

 3    Website Owner            Registers website: POST /v1/tenants/{id}/websites
                               Body: { domain: "example.com" }

 4    Tenant Service           ├─ Generate verification token
                               ├─ Create website record (status: pending)
                               └─ Return instructions: "Add DNS TXT record OR meta tag"

 5    Website Owner            Adds DNS TXT: wba-verify=abc123xyz

 6    Verification Worker      ├─ Scheduled check (every 5 min for 24h)
      (Async)                  ├─ DNS lookup for TXT records
                               ├─ Match verification token
                               ├─ On success: website.verified = true, status = active
                               └─ Notify owner: "Domain verified!"

 7    Website Owner            Creates API key: POST /v1/tenants/{id}/api-keys
                               Body: { name: "Production", scopes: ["read:assistant"] }

 8    Auth Service             ├─ Generate key: wba_live_t8f2k_a3Bx9mZ7...
                               ├─ Store SHA-256 hash
                               ├─ Return full key (shown ONCE)
                               └─ Owner saves key for integration

 9    Website Owner            Uploads knowledge: POST /v1/knowledge/documents
                               → Triggers ingestion flow (see Flow #2)

10    Website Owner            Installs Chrome extension script or embed snippet
                               <script src="https://cdn.platform.com/widget.js"
                                       data-api-key="wba_live_t8f2k_..." />

11    End User                 Visits example.com → widget loads → assistant ready
```

---

## 4. Billing & Usage Flow

```
Step  Actor/Component          Action
────  ──────────────────────   ─────────────────────────────────────

 1    AI Orchestration         After every query → emit usage event to SQS:
                               { tenant_id, tokens_in, tokens_out, model, timestamp }

 2    Usage Aggregator         ├─ Consume events from SQS (batch: 100)
      (Every 5 min)            ├─ Aggregate per tenant per period
                               ├─ Upsert into usage_records table
                               └─ Check thresholds:
                                   ├─ 80% quota → emit warning event
                                   ├─ 90% quota → emit critical event
                                   └─ 100% quota → emit quota_exceeded event

 3    Billing Service          ├─ On quota warning: send email notification
      (Event-driven)           ├─ On quota exceeded:
                               │   ├─ Soft limit: degrade to cheaper model
                               │   └─ Hard limit: reject queries (402 response)
                               ├─ End of billing period:
                               │   ├─ Calculate final usage
                               │   ├─ Generate invoice via Stripe
                               │   └─ Emit billing.invoice.created event
                               └─ On payment failure:
                                   ├─ Retry 3x over 7 days
                                   ├─ Send dunning emails
                                   └─ Suspend tenant after 14 days
```

---

## 5. Technology Summary

| Category | Technology | Purpose |
|----------|-----------|---------|
| **API Services** | Node.js (Fastify) / Go | CRUD services, API gateway plugins |
| **AI Services** | Python (FastAPI) | Orchestration, RAG, embeddings |
| **Database** | PostgreSQL 16 (RDS Multi-AZ) | Primary data store |
| **Vector DB** | Qdrant (self-hosted) or Pinecone | Embedding storage & retrieval |
| **Cache** | Redis 7 Cluster (ElastiCache) | Sessions, rate limits, response cache |
| **Queue** | AWS SQS + SNS | Async processing, event bus |
| **Storage** | AWS S3 | Documents, exports, audit logs |
| **Container Orchestration** | AWS EKS (Kubernetes 1.29) | Service deployment & scaling |
| **CI/CD** | GitHub Actions + ArgoCD | Build, test, deploy |
| **Monitoring** | Datadog + PagerDuty | Metrics, logs, traces, alerts |
| **CDN/WAF** | Cloudflare | Edge security, static assets |
| **Secrets** | AWS Secrets Manager | Credentials management |
| **LLM Providers** | OpenAI, Anthropic, Google, vLLM | AI inference |
| **Embeddings** | OpenAI text-embedding-3-large | Document & query vectorization |
| **Billing** | Stripe | Payments, subscriptions, invoicing |
| **Feature Flags** | LaunchDarkly / custom (Redis) | Gradual rollout, per-tenant features |
| **IaC** | Terraform | Infrastructure provisioning |

---

## End of Architecture Document

> This architecture is designed for **production deployment** at scale. It supports
> multi-tenancy, strong data isolation, cost-effective AI inference, and enterprise-grade
> security. The modular microservices design allows independent evolution of each bounded
> context while maintaining operational simplicity through Kubernetes and GitOps.
>
> **Next Steps:**
> 1. Prioritize MVP services (Auth, Tenant, AI Orchestration, Knowledge Base)
> 2. Define OpenAPI specs for v1 endpoints
> 3. Set up infrastructure (Terraform + EKS)
> 4. Implement core RAG pipeline
> 5. Build billing integration
> 6. Security audit before launch
