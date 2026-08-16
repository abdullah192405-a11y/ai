#!/bin/bash
# ═══════════════════════════════════════════════════════════
# LocalStack Initialization Script
# Creates S3 buckets and SQS queues for local development
# ═══════════════════════════════════════════════════════════

set -euo pipefail

echo "🚀 Initializing LocalStack resources..."

# ─── S3 Buckets ──────────────────────────────────────────
awslocal s3 mb s3://wba-platform-dev
echo "  ✅ S3 bucket: wba-platform-dev"

# ─── SQS Queues ──────────────────────────────────────────
# Document Ingestion Queue (FIFO)
awslocal sqs create-queue \
  --queue-name document-ingestion.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true
echo "  ✅ SQS queue: document-ingestion.fifo"

# Document Ingestion DLQ
awslocal sqs create-queue \
  --queue-name document-ingestion-dlq.fifo \
  --attributes FifoQueue=true
echo "  ✅ SQS queue: document-ingestion-dlq.fifo"

# Usage Events Queue
awslocal sqs create-queue --queue-name usage-events
echo "  ✅ SQS queue: usage-events"

# Usage Events DLQ
awslocal sqs create-queue --queue-name usage-events-dlq
echo "  ✅ SQS queue: usage-events-dlq"

# Analytics Events Queue
awslocal sqs create-queue --queue-name analytics-events
echo "  ✅ SQS queue: analytics-events"

# Notifications Queue
awslocal sqs create-queue --queue-name notifications
echo "  ✅ SQS queue: notifications"

# Domain Verification Queue
awslocal sqs create-queue --queue-name domain-verification
echo "  ✅ SQS queue: domain-verification"

# ─── SNS Topics ──────────────────────────────────────────
awslocal sns create-topic --name platform-events
echo "  ✅ SNS topic: platform-events"

echo ""
echo "✅ LocalStack initialization complete!"
