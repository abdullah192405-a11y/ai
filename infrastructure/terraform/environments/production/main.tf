# ═══════════════════════════════════════════════════════════
# WBA Platform — Terraform Root Module
# Environment: Production
# ═══════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  backend "s3" {
    bucket         = "wba-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "wba-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "wba-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ─── Variables ────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.xlarge"
}

variable "eks_node_instance_types" {
  description = "EKS general node instance types"
  type        = list(string)
  default     = ["c6i.xlarge"]
}

# ─── Modules ─────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  environment     = var.environment
  vpc_cidr        = "10.0.0.0/16"
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

module "eks" {
  source = "../../modules/eks"

  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  node_instance_types   = var.eks_node_instance_types
  node_min_size         = 3
  node_max_size         = 20
  node_desired_size     = 5
}

module "rds" {
  source = "../../modules/rds"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  instance_class     = var.db_instance_class
  db_name            = "wba_platform"
  multi_az           = true
  backup_retention   = 30
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.redis_node_type
  num_cache_nodes    = 3
  num_replicas       = 1
}

module "s3" {
  source = "../../modules/s3"

  environment = var.environment
  bucket_name = "wba-platform-${var.environment}"
}

module "sqs" {
  source = "../../modules/sqs"

  environment = var.environment
  queues = {
    "document-ingestion" = { fifo = true,  dlq = true,  max_retries = 3 }
    "usage-events"       = { fifo = false, dlq = true,  max_retries = 3 }
    "analytics-events"   = { fifo = false, dlq = true,  max_retries = 3 }
    "notifications"      = { fifo = false, dlq = true,  max_retries = 3 }
    "domain-verification"= { fifo = false, dlq = true,  max_retries = 3 }
  }
}

module "secrets_manager" {
  source = "../../modules/secrets-manager"

  environment = var.environment
  secrets = [
    "wba/db-credentials",
    "wba/redis-credentials",
    "wba/jwt-keys",
    "wba/stripe-keys",
    "wba/openai-api-key",
    "wba/anthropic-api-key",
  ]
}

# ─── Outputs ─────────────────────────────────────────────

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.endpoint
  sensitive = true
}

output "s3_bucket_name" {
  value = module.s3.bucket_name
}
