# 06 — Infrastructure & Scalability

---

## 1. Containerization & Orchestration

### Kubernetes (EKS) Cluster Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    EKS CLUSTER LAYOUT                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Namespace: wba-platform                                     │
│  ├─ api-gateway        (3 replicas, c6i.xlarge)              │
│  ├─ auth-service       (2 replicas, c6i.large)               │
│  ├─ tenant-service     (2 replicas, c6i.large)               │
│  ├─ billing-service    (2 replicas, c6i.large)               │
│  ├─ analytics-service  (2 replicas, c6i.large)               │
│  └─ admin-service      (1 replica,  c6i.large)               │
│                                                              │
│  Namespace: wba-ai                                           │
│  ├─ ai-orchestration   (4 replicas, c6i.2xlarge)             │
│  ├─ knowledge-service  (3 replicas, c6i.xlarge)              │
│  ├─ llm-gateway        (3 replicas, c6i.xlarge)              │
│  └─ embedding-workers  (2 replicas, g5.xlarge) [GPU]         │
│                                                              │
│  Namespace: wba-data                                         │
│  ├─ redis-cluster      (6 pods, r6g.xlarge)                  │
│  └─ qdrant-cluster     (3 pods, r6g.2xlarge) [if self-hosted]│
│                                                              │
│  Namespace: wba-infra                                        │
│  ├─ ingress-nginx      (2 replicas)                          │
│  ├─ cert-manager                                             │
│  ├─ external-secrets-operator                                │
│  ├─ otel-collector     (DaemonSet)                           │
│  └─ keda               (autoscaler)                          │
│                                                              │
│  Node Groups:                                                │
│  ├─ general:  c6i.xlarge  (4 vCPU, 8GB)   min:3, max:20     │
│  ├─ compute:  c6i.2xlarge (8 vCPU, 16GB)  min:2, max:15     │
│  ├─ memory:   r6g.xlarge  (4 vCPU, 32GB)  min:2, max:10     │
│  └─ gpu:      g5.xlarge   (1 GPU, 16GB)   min:0, max:8      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Horizontal Scaling Strategy

| Service | Scaling Metric | Min | Max | Scale Trigger |
|---------|---------------|-----|-----|---------------|
| API Gateway | CPU + RPS | 3 | 20 | CPU > 60% or RPS > 5000/pod |
| AI Orchestration | Concurrent requests | 4 | 30 | Queue depth > 50 |
| Knowledge Service | CPU + memory | 3 | 15 | CPU > 70% |
| LLM Gateway | Concurrent requests | 3 | 20 | Active connections > 100/pod |
| Embedding Workers | Queue depth | 0 | 8 | SQS messages > 100 |
| Auth Service | RPS | 2 | 10 | RPS > 2000/pod |

### Autoscaler: **KEDA** (Kubernetes Event-Driven Autoscaling)

```yaml
# Example: AI Orchestration autoscaler
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: ai-orchestration-scaler
spec:
  scaleTargetRef:
    name: ai-orchestration
  minReplicaCount: 4
  maxReplicaCount: 30
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: ai_concurrent_requests
        threshold: "50"
        query: sum(ai_orchestration_active_requests)
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs.us-east-1.amazonaws.com/.../ai-query-queue
        queueLength: "50"
```

---

## 3. Load Balancing

```
Internet
    │
    ▼
┌──────────────┐
│  Cloudflare  │  ← CDN, DDoS protection, WAF
│  (L7 proxy)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  AWS ALB     │  ← TLS termination, health checks
│  (L7 LB)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Ingress     │  ← Path-based routing, rate limiting
│  Controller  │
│  (NGINX)     │
└──────┬───────┘
       │
       ▼
  K8s Services (ClusterIP) → Pod endpoints
```

---

## 4. Queue Systems & Background Jobs

```
┌─────────────────────────────────────────────────────────────┐
│              ASYNC PROCESSING ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Queue: document-ingestion (SQS FIFO)                       │
│  ├─ Producer: Knowledge Base Service                        │
│  ├─ Consumer: Embedding Worker (autoscaled 0→8)             │
│  └─ Purpose: Document chunking + embedding pipeline         │
│                                                             │
│  Queue: usage-events (SQS Standard)                         │
│  ├─ Producer: AI Orchestration Service                      │
│  ├─ Consumer: Billing/Metering Aggregator                   │
│  └─ Purpose: Async usage metering (fire-and-forget)         │
│                                                             │
│  Queue: analytics-events (SQS Standard → SNS fanout)        │
│  ├─ Producer: All services                                  │
│  ├─ Consumer: Analytics Service + Audit Logger              │
│  └─ Purpose: Event streaming for dashboards                 │
│                                                             │
│  Queue: notifications (SQS Standard)                        │
│  ├─ Producer: Billing, Auth, Admin services                 │
│  ├─ Consumer: Notification Service (email/webhook)          │
│  └─ Purpose: Emails, webhook deliveries, alerts             │
│                                                             │
│  Queue: domain-verification (SQS with delay)                │
│  ├─ Producer: Tenant Service                                │
│  ├─ Consumer: Verification Worker                           │
│  └─ Purpose: Async DNS verification with retry              │
│                                                             │
│  Dead Letter Queues (DLQ):                                  │
│  ├─ Each queue has a DLQ                                    │
│  ├─ Max retries: 3                                          │
│  ├─ DLQ messages trigger alert                              │
│  └─ Manual retry via admin panel                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Monitoring & Observability Stack

```
┌─────────────────────────────────────────────────────────┐
│           OBSERVABILITY STACK                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────┐                                     │
│  │    Metrics      │                                    │
│  │  (Prometheus +  │                                    │
│  │   Datadog)      │                                    │
│  └────────┬───────┘                                     │
│           │                                             │
│  ┌────────▼───────┐    ┌────────────────┐               │
│  │   Grafana      │    │   PagerDuty    │               │
│  │  Dashboards    │───▶│   Alerting     │               │
│  └────────────────┘    └────────────────┘               │
│                                                         │
│  ┌────────────────┐                                     │
│  │    Logging      │                                    │
│  │  (Fluentd →    │                                     │
│  │   CloudWatch / │                                     │
│  │   Datadog Logs)│                                     │
│  └────────────────┘                                     │
│                                                         │
│  ┌────────────────┐                                     │
│  │    Tracing      │                                    │
│  │  (OpenTelemetry│                                     │
│  │   → Jaeger /   │                                     │
│  │   Datadog APM) │                                     │
│  └────────────────┘                                     │
│                                                         │
│  Key Alerts:                                            │
│  ├─ Error rate > 1% for 5 min → P2                      │
│  ├─ Error rate > 5% for 2 min → P1                      │
│  ├─ P99 latency > 5s for 5 min → P2                     │
│  ├─ LLM provider down → P1                              │
│  ├─ Queue depth > 1000 → P2                             │
│  ├─ Disk usage > 80% → P3                               │
│  └─ Certificate expiry < 14 days → P3                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. CI/CD Pipeline

```
Developer pushes code
        │
        ▼
┌──────────────┐    ┌──────────────┐    ┌─────────────────┐
│  GitHub      │───▶│  Build &     │───▶│  Deploy to      │
│  Actions     │    │  Test        │    │  Staging (auto)  │
│              │    │  - Unit      │    │                  │
│              │    │  - Lint      │    │  Deploy to       │
│              │    │  - Security  │    │  Prod (manual    │
│              │    │  - Docker    │    │   approval)      │
└──────────────┘    └──────────────┘    └─────────────────┘

Strategy: GitOps with ArgoCD
Registry: AWS ECR
Environments: dev → staging → production
Rollback: Automated on health check failure (< 2 min)
```

---

*Continue to `07-SECURITY.md` →*
