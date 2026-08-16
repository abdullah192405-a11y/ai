# AI Website Assistant Platform — Production Architecture

> **Version:** 1.0.0  
> **Date:** 2026-02-18  
> **Classification:** Confidential — Internal Architecture Document  
> **Author:** System Architecture Team  

---

## Table of Contents

| # | Document | Description |
|---|----------|-------------|
| 00 | `00-OVERVIEW.md` | This file — High-level architecture & decisions |
| 01 | `01-CORE-SERVICES.md` | Core platform microservices breakdown |
| 02 | `02-AI-AGENT-ARCHITECTURE.md` | AI/Bot engine, RAG pipeline, LLM orchestration |
| 03 | `03-DASHBOARD-AND-ADMIN.md` | Website owner dashboard & admin panel architecture |
| 04 | `04-DATABASE-ARCHITECTURE.md` | Data models, multi-tenancy, vector DB, caching |
| 05 | `05-API-ARCHITECTURE.md` | API design, auth flows, versioning, rate limiting |
| 06 | `06-INFRASTRUCTURE.md` | Cloud infra, scaling, containers, observability |
| 07 | `07-SECURITY.md` | Security architecture, encryption, RBAC, audit |
| 08 | `08-EXTENSIBILITY.md` | Plugin system, webhooks, enterprise & on-prem |
| 09 | `09-DATA-FLOW-DIAGRAMS.md` | End-to-end data flow & sequence descriptions |

---

## 1. Executive Summary

This document defines the production-ready architecture for an **AI-powered Website Assistant Platform** — a multi-tenant SaaS system that provides contextual, domain-aware AI agents to website owners. Unlike general-purpose chatbots, each AI agent is scoped to a specific website, understands its structure, and guides end users step-by-step within that site.

### System Actors

```
┌─────────────────────────────────────────────────────────┐
│                    SYSTEM ACTORS                        │
├──────────────────┬──────────────────────────────────────┤
│ Platform Admin   │ Manages platform, clients, models,  │
│ (System Owner)   │ billing, feature flags, monitoring   │
├──────────────────┼──────────────────────────────────────┤
│ Website Owner    │ Subscribes, registers website,       │
│ (Client/Tenant)  │ trains KB, manages API keys          │
├──────────────────┼──────────────────────────────────────┤
│ End User         │ Interacts with AI assistant via      │
│ (Visitor)        │ Chrome extension or embedded script  │
└──────────────────┴──────────────────────────────────────┘
```

---

## 2. Architectural Decision: Microservices

### Decision: **Domain-Driven Microservices**

### Justification

| Factor | Modular Monolith | Microservices ✅ |
|--------|-------------------|------------------|
| Independent scaling of AI workloads | ❌ Coupled | ✅ Scale AI independently |
| Multi-tenant data isolation | Harder | ✅ Service-level isolation |
| Team autonomy | Limited | ✅ Independent deployment |
| Technology heterogeneity (Python AI + Node API) | ❌ Single runtime | ✅ Polyglot support |
| Fault isolation (LLM failures) | ❌ Cascading | ✅ Bulkhead pattern |
| Billing/Auth independent evolution | Coupled | ✅ Independent lifecycle |
| Operational complexity | ✅ Simpler | Managed via K8s + service mesh |

**Verdict:** The AI workloads (GPU-bound, bursty) have fundamentally different scaling characteristics than CRUD services. Multi-tenancy requires strong isolation. Microservices are the correct choice for this domain.

### Evolutionary Note
Start with **6–8 core services** (not 30). Split further only when a service owns multiple bounded contexts that evolve at different rates.

---

## 3. High-Level System Architecture

```
                         ┌──────────────┐
                         │   Cloudflare  │
                         │   CDN / WAF   │
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │  API Gateway  │
                         │ (Kong / AWS   │
                         │  API Gateway) │
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
     ┌────────▼──────┐  ┌──────▼───────┐  ┌──────▼──────────┐
     │  Auth Service  │  │  Tenant Mgmt │  │  Billing        │
     │  (JWT/OAuth2)  │  │  Service     │  │  Service        │
     └────────────────┘  └──────────────┘  └─────────────────┘
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   AI Orchestration    │
                    │   Service             │
                    │   (Core Brain)        │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                   │
     ┌────────▼──────┐  ┌──────▼────────┐  ┌──────▼──────────┐
     │  Knowledge    │  │  LLM Gateway  │  │  Action         │
     │  Base Service │  │  (Model       │  │  Execution      │
     │  (RAG Engine) │  │   Abstraction)│  │  Service        │
     └───────────────┘  └───────────────┘  └─────────────────┘
              │                 │                   │
     ┌────────▼──────┐  ┌──────▼────────┐  ┌──────▼──────────┐
     │  Vector DB    │  │  OpenAI /     │  │  Analytics      │
     │  (Pinecone/   │  │  Anthropic /  │  │  & Monitoring   │
     │   Qdrant)     │  │  Self-hosted  │  │  Service        │
     └───────────────┘  └───────────────┘  └─────────────────┘
```

---

## 4. Service Boundaries

| Service | Bounded Context | Tech Stack | Scaling Profile |
|---------|----------------|------------|-----------------|
| **API Gateway** | Routing, rate limiting, auth verification | Kong / AWS API GW | Horizontal, stateless |
| **Auth Service** | Identity, JWT, OAuth2, API keys | Node.js / Go | Horizontal, stateless |
| **Tenant Management** | Website registration, config, API key lifecycle | Node.js / Go | Low traffic, vertical |
| **Billing Service** | Subscriptions, usage metering, invoicing | Node.js + Stripe SDK | Low traffic, event-driven |
| **AI Orchestration** | Request routing, context assembly, response generation | Python (FastAPI) | Horizontal, GPU-aware |
| **Knowledge Base Service** | Document ingestion, chunking, embedding, retrieval | Python (FastAPI) | Burst on ingestion, steady on retrieval |
| **LLM Gateway** | Model abstraction, fallback, cost tracking | Python (FastAPI) | Horizontal, latency-sensitive |
| **Action Execution** | Navigation, downloads, user-approved actions | Node.js / Go | Event-driven, low traffic |
| **Analytics Service** | Usage tracking, dashboards, reporting | Go / Python | Event-driven, async |
| **Admin Service** | Platform admin operations, feature flags | Node.js / Go | Low traffic, internal only |

---

## 5. Cloud Deployment Model

### Primary: **AWS (with multi-cloud abstraction)**

```
Region Strategy:
├── Primary:    us-east-1  (Main workloads)
├── Secondary:  eu-west-1  (GDPR compliance, EU clients)
└── DR:         us-west-2  (Disaster recovery, warm standby)
```

| Layer | AWS Service | Purpose |
|-------|-------------|---------|
| Compute | EKS (Kubernetes) | Container orchestration |
| AI Compute | EKS + GPU nodes (p4d/g5) | LLM inference if self-hosted |
| Database | RDS PostgreSQL (Multi-AZ) | Primary relational data |
| Vector DB | Managed Qdrant / Pinecone | Embedding storage & retrieval |
| Cache | ElastiCache (Redis) | Session, rate limiting, response cache |
| Queue | SQS + SNS | Async processing, event bus |
| Storage | S3 | Document storage, logs, backups |
| CDN | CloudFront + Cloudflare | Static assets, WAF |
| Secrets | AWS Secrets Manager | API keys, credentials |
| Monitoring | CloudWatch + Datadog | Metrics, logs, traces |

---

*Continue to `01-CORE-SERVICES.md` for detailed service specifications →*
