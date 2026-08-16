# 05 — API Architecture

---

## 1. API-First Design Principles

| Principle | Implementation |
|-----------|---------------|
| Contract-first | OpenAPI 3.1 spec written before code |
| Consistent error format | RFC 7807 Problem Details |
| Idempotency | Idempotency-Key header for POST/PUT |
| Pagination | Cursor-based (not offset) for all list endpoints |
| Filtering | Standardized query params: `?filter[status]=active` |
| Sorting | `?sort=-created_at,name` |
| Field selection | `?fields=id,name,status` |
| Versioning | URL-based: `/v1/`, `/v2/` |
| Content negotiation | `Accept: application/json` (default) |

---

## 2. Authentication Flows

### Flow 1: Website Owner (Dashboard) — JWT/OAuth2

```
┌──────────┐    POST /v1/auth/login     ┌──────────────┐
│ Dashboard │─────────────────────────▶  │ Auth Service  │
│  Client   │  { email, password }       │              │
│           │◀─────────────────────────  │              │
│           │  { access_token (15min),   │              │
│           │    refresh_token (7d) }    │              │
└──────────┘                            └──────────────┘

Subsequent requests:
  Authorization: Bearer <access_token>

Token refresh:
  POST /v1/auth/refresh
  Body: { refresh_token }
  → New access_token + rotated refresh_token
```

### Flow 2: End User (Assistant Query) — API Key

```
┌─────────────┐   POST /v1/assistant/query    ┌─────────────┐
│ Chrome Ext / │──────────────────────────────▶│ API Gateway  │
│ Embed Script │   X-API-Key: wba_live_...    │             │
│              │   Origin: https://example.com │             │
└─────────────┘                               └──────┬──────┘
                                                      │
                                              ┌───────▼──────┐
                                              │ Auth verify  │
                                              │ 1. Hash key  │
                                              │ 2. Redis     │
                                              │    lookup    │
                                              │ 3. Check:    │
                                              │  - not       │
                                              │    revoked   │
                                              │  - not       │
                                              │    expired   │
                                              │  - origin    │
                                              │    allowed   │
                                              │  - scope     │
                                              │    valid     │
                                              └──────────────┘
```

### Flow 3: Platform Admin — JWT + MFA

```
Additional security for admin:
  - Mandatory MFA (TOTP)
  - IP allowlist
  - Session max duration: 4 hours
  - Actions logged to audit trail
```

---

## 3. API Versioning Strategy

```
URL-based versioning: /v1/, /v2/

Version Lifecycle:
  ├─ v1 (current)  → Stable, fully supported
  ├─ v2 (future)   → When breaking changes needed
  └─ Deprecation:  12-month notice, sunset headers

Headers on deprecated endpoints:
  Deprecation: true
  Sunset: Sat, 01 Jan 2028 00:00:00 GMT
  Link: <https://api.platform.com/v2/docs>; rel="successor-version"
```

---

## 4. Rate Limiting Design

```
┌──────────────────────────────────────────────────────┐
│              RATE LIMITING ARCHITECTURE               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Algorithm: Sliding Window Counter (Redis)           │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Key: rl:{tenant_id}:{endpoint}:{window_ts}   │    │
│  │ Value: counter (INCR)                        │    │
│  │ TTL: window_size * 2                         │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Tiers:                                              │
│  ├─ Free:       10 req/min,    1,000 req/day         │
│  ├─ Starter:    60 req/min,   10,000 req/day         │
│  ├─ Pro:       300 req/min,  100,000 req/day         │
│  └─ Enterprise: Custom                               │
│                                                      │
│  Response on limit exceeded:                         │
│  HTTP 429 Too Many Requests                          │
│  {                                                   │
│    "type": "rate_limit_exceeded",                    │
│    "title": "Rate limit exceeded",                   │
│    "detail": "You have exceeded 60 requests/minute", │
│    "retry_after": 23                                 │
│  }                                                   │
│  Headers:                                            │
│    X-RateLimit-Limit: 60                             │
│    X-RateLimit-Remaining: 0                          │
│    X-RateLimit-Reset: 1708300823                     │
│    Retry-After: 23                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. Standard Response Envelope

### Success Response
```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-02-18T16:00:00Z",
    "version": "v1"
  }
}
```

### Paginated Response
```json
{
  "data": [ ... ],
  "meta": {
    "request_id": "req_abc123",
    "total_count": 142,
    "has_more": true,
    "cursor": "eyJpZCI6IjEyMyJ9"
  }
}
```

### Error Response (RFC 7807)
```json
{
  "type": "https://api.platform.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "The 'domain' field must be a valid hostname.",
  "instance": "/v1/tenants/t_abc/websites",
  "errors": [
    {
      "field": "domain",
      "message": "Must be a valid hostname without protocol",
      "code": "INVALID_HOSTNAME"
    }
  ],
  "request_id": "req_abc123"
}
```

---

## 6. Observability

```
Every request carries:
  X-Request-ID:    Generated at API Gateway (uuid v7)
  X-Correlation-ID: Propagated across all services
  X-Tenant-ID:     Injected after auth verification

Logging format (structured JSON):
{
  "timestamp": "2026-02-18T16:00:00.123Z",
  "level": "info",
  "service": "ai-orchestration",
  "request_id": "req_abc123",
  "correlation_id": "corr_xyz789",
  "tenant_id": "t_abc123",
  "method": "POST",
  "path": "/v1/assistant/query",
  "status": 200,
  "latency_ms": 1243,
  "tokens_used": 847,
  "model": "gpt-4o",
  "cache_hit": false
}

Distributed Tracing: OpenTelemetry → Jaeger / Datadog APM
  Spans: gateway → auth → orchestration → knowledge → llm → response
```

---

*Continue to `06-INFRASTRUCTURE.md` →*
