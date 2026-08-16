# 02 — AI Agent / Bot Architecture

---

## 1. Request Lifecycle

```
End User (Chrome Extension / Embedded Widget)
        │
        │  POST /v1/assistant/query
        │  Headers: X-API-Key: wba_live_...
        │  Body: { domain, page_url, question, session_id?, conversation_history? }
        │
        ▼
┌───────────────┐
│  API Gateway  │── Rate limit check ──▶ Redis
│               │── API key verify ────▶ Auth Service (cached)
└───────┬───────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│              AI ORCHESTRATION SERVICE                     │
│                                                          │
│  Step 1: Validate & Authenticate                         │
│  ├─ Verify tenant_id from API key                        │
│  ├─ Check tenant status (active, quota not exceeded)     │
│  └─ Extract context: domain, page_url, question          │
│                                                          │
│  Step 2: Session Management                              │
│  ├─ Load or create conversation session (Redis)          │
│  ├─ Append user message to conversation history          │
│  └─ Trim history to last N turns (configurable)          │
│                                                          │
│  Step 3: Response Cache Check                            │
│  ├─ Generate cache key: hash(tenant_id + url + question) │
│  ├─ If cache HIT → return cached response (TTL: 15 min) │
│  └─ If cache MISS → proceed to Step 4                    │
│                                                          │
│  Step 4: Context Assembly                                │
│  ├─ Build context object:                                │
│  │   { domain, page_url, page_path, tenant_config,      │
│  │     conversation_history, user_question }             │
│  └─ Enrich with page-specific metadata (if available)    │
│                                                          │
│  Step 5: Knowledge Retrieval (RAG)                       │
│  ├─ Call Knowledge Base Service                          │
│  ├─ Embed question → vector search                       │
│  ├─ Retrieve top-K relevant chunks (K=5, reranked)       │
│  └─ Filter by page_url relevance (boost same-page docs)  │
│                                                          │
│  Step 6: Prompt Construction                             │
│  ├─ System prompt (role, constraints, tone)              │
│  ├─ Context injection (domain, URL, page info)           │
│  ├─ Retrieved knowledge chunks                           │
│  ├─ Conversation history                                 │
│  ├─ User question                                        │
│  └─ Action instructions (if actions enabled)             │
│                                                          │
│  Step 7: LLM Invocation                                  │
│  ├─ Route to LLM Gateway                                 │
│  ├─ Stream response tokens                               │
│  └─ Parse structured output (text + optional actions)    │
│                                                          │
│  Step 8: Post-Processing                                 │
│  ├─ Validate response safety                             │
│  ├─ Extract action proposals (navigate, download, etc.)  │
│  ├─ Cache response                                       │
│  ├─ Emit usage event (async)                             │
│  └─ Return response to client                            │
│                                                          │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Knowledge Retrieval Flow (RAG Pipeline)

### Ingestion Pipeline (Async — Triggered by Website Owner)

```
Website Owner uploads documents / URLs / FAQs
        │
        ▼
┌──────────────────┐
│  Knowledge Base  │
│  Service         │
├──────────────────┤
│                  │
│  1. INTAKE       │──▶ Validate format, size, tenant quota
│                  │
│  2. EXTRACT      │──▶ Parse content:
│     │            │    - PDF → text (Apache Tika)
│     │            │    - URL → crawl + extract (Playwright)
│     │            │    - FAQ → structured Q&A pairs
│     │            │    - Markdown / plain text → passthrough
│     │            │
│  3. CHUNK        │──▶ Split into semantic chunks:
│     │            │    - Chunk size: 512 tokens (configurable)
│     │            │    - Overlap: 64 tokens
│     │            │    - Strategy: recursive text splitter
│     │            │    - Preserve metadata: source_url, section, page
│     │            │
│  4. EMBED        │──▶ Generate embeddings:
│     │            │    - Model: text-embedding-3-large (1536 dims)
│     │            │    - Batch processing: 100 chunks/batch
│     │            │
│  5. INDEX        │──▶ Store in Vector DB:
│     │            │    - Namespace: tenant_id
│     │            │    - Metadata: source_url, chunk_index, doc_type
│     │            │
│  6. REGISTER     │──▶ Update document registry in PostgreSQL
│                  │
└──────────────────┘
```

### Retrieval Pipeline (Sync — Per User Query)

```
User Question
      │
      ▼
┌─ EMBED ──────────────────────────────────────────────┐
│  Embed question using same model (text-embedding-3-large)
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌─ SEARCH ─────────────────────────────────────────────┐
│  Vector similarity search in tenant's namespace       │
│  Parameters:                                          │
│    top_k: 20                                          │
│    score_threshold: 0.72                              │
│    filter: { tenant_id: "t_abc123" }                  │
│    boost: { source_url matches current page_url }     │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌─ RERANK ─────────────────────────────────────────────┐
│  Cross-encoder reranking (Cohere Rerank / BGE Reranker)
│  Input: question + 20 candidate chunks                │
│  Output: top 5 most relevant chunks (reranked)        │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌─ AUGMENT ────────────────────────────────────────────┐
│  Assemble context for LLM prompt                      │
│  Include: chunk text, source attribution, relevance   │
└──────────────────────────────────────────────────────┘
```

---

## 3. LLM Gateway / Model Abstraction Layer

```
┌───────────────────────────────────────────────────┐
│              LLM GATEWAY SERVICE                  │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐                                  │
│  │  Router     │ ← tenant model preference        │
│  │             │ ← request priority                │
│  │             │ ← cost optimization rules         │
│  └──────┬──────┘                                  │
│         │                                         │
│         ├──▶ OpenAI Adapter     (GPT-4o, GPT-4o-mini)
│         ├──▶ Anthropic Adapter  (Claude 3.5 Sonnet)
│         ├──▶ Google Adapter     (Gemini 2.0 Pro)  │
│         ├──▶ Self-Hosted Adapter(vLLM / Ollama)   │
│         └──▶ Fallback Chain     (primary → secondary)
│                                                   │
│  Features:                                        │
│  ├─ Unified request/response schema               │
│  ├─ Streaming support (SSE)                       │
│  ├─ Token counting & cost tracking                │
│  ├─ Timeout management (30s default)              │
│  ├─ Retry with exponential backoff (3 attempts)   │
│  ├─ Circuit breaker (per provider)                │
│  ├─ Fallback chain (e.g., GPT-4o → Claude → mini)│
│  └─ Response normalization                        │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Model Fallback Chain
```
Primary Model (tenant preference)
    │ ── timeout/error ──▶ Secondary Model
                              │ ── timeout/error ──▶ Tertiary Model (cost-optimized)
                                                          │ ── failure ──▶ Graceful Error Response
```

---

## 4. Prompt Architecture

### System Prompt Template
```
You are {assistant_name}, an AI assistant for {domain}.
You help users navigate and use the website at {domain}.

CONTEXT:
- Current page: {page_url}
- Page section: {page_path}

KNOWLEDGE BASE:
{retrieved_knowledge_chunks}

RULES:
1. Only answer based on the provided knowledge base.
2. If you don't know, say so — do not hallucinate.
3. Provide step-by-step guidance when applicable.
4. Reference specific pages/sections when directing users.
5. You may suggest actions (navigate, scroll, highlight) but
   NEVER execute without explicit user approval.
6. Keep responses concise and actionable.

AVAILABLE ACTIONS (if enabled):
- navigate(url): Suggest navigating to a URL
- highlight(selector): Suggest highlighting an element
- scroll_to(selector): Suggest scrolling to an element
```

---

## 5. Caching Strategy

| Cache Layer | Key Pattern | TTL | Purpose |
|-------------|-------------|-----|---------|
| API Key → Tenant | `auth:apikey:<hash>` | 5 min | Avoid DB lookup per request |
| Embedding Cache | `embed:<hash(text)>` | 24 hr | Avoid re-embedding same queries |
| Response Cache | `resp:<tenant>:<hash(url+q)>` | 15 min | Identical question dedup |
| KB Chunk Cache | `kb:<tenant>:<chunk_id>` | 1 hr | Hot knowledge chunks |
| Session Cache | `session:<session_id>` | 30 min | Conversation history |
| Rate Limit Counters | `rl:<tenant>:<window>` | 1 min | Sliding window counters |

**Cache Backend:** Redis Cluster (ElastiCache) with read replicas.

---

## 6. Failure Handling

| Failure | Detection | Recovery |
|---------|-----------|----------|
| LLM provider timeout | 30s timeout | Fallback to secondary model |
| LLM provider 5xx | HTTP status | Circuit breaker → fallback provider |
| Vector DB unavailable | Health check | Return degraded response (no KB context) |
| Rate limit exceeded | Counter check | 429 response with retry-after header |
| Quota exhausted | Usage check | 402 response, notify tenant |
| Malformed input | Validation | 400 with detailed error schema |
| Unsafe LLM output | Content filter | Redact + log for review |
| Embedding failure | API error | Retry 2x → return error |

### Circuit Breaker Config
```
State: CLOSED → OPEN → HALF-OPEN → CLOSED
Threshold: 5 failures in 60 seconds → OPEN
Open Duration: 30 seconds
Half-Open: Allow 1 request through to test
```

---

*Continue to `03-DASHBOARD-AND-ADMIN.md` →*
