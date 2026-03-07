# Agent Context Platform (ACP)

A unified, AI-agent-optimized data store for business entity context. Instead of AI agents querying multiple operational systems (Salesforce, Snowflake, SQL databases) directly via individual MCP servers, the ACP provides a single curated context store that agents read from and write to via MCP tools.

Your data pipelines extract and map data from source systems into the ACP's canonical model via a REST API. Your AI agents then read enriched entity profiles and record decisions back through an MCP server — no direct database access, no per-source-system integration code in the agent. Deploy the entire platform into your own AWS account with a single `cdk deploy`.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Build](#build)
- [Testing](#testing)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [Context Object Model](#context-object-model)
- [MCP Tools](#mcp-tools)
- [REST API](#rest-api)
- [Project Structure](#project-structure)

---

## Quick Start

### Prerequisites

- **Node.js** 20.x
- **pnpm** (`npm install -g pnpm`)
- **Docker** (for local Postgres)
- **AWS CLI** + **AWS CDK CLI** (for deployment)

### Local Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Start Postgres (pgvector:pg16 on port 5432)
docker compose up db

# Run migrations
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/scripts run migrate

# Seed sample data (Acme Corp, Globex Industries)
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/scripts run seed

# Start the REST API on :3000
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp PORT=3002 pnpm --filter @acp/api run dev

# Start the MCP server on :3001
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/mcp-server run dev
```

### Try it out

```bash
# Health check
curl http://localhost:3002/v1/health

# Upsert an entity
curl -X POST http://localhost:3002/v1/objects \
  -H "Authorization: Bearer dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "objectType": "entity",
    "subtype": "customer",
    "canonicalName": "Wayne Enterprises",
    "context": {
      "attributes": { "name": "Wayne Enterprises", "industry": "Defense", "segment": "enterprise" },
      "measures": { "arr": 2000000, "healthScore": 91 }
    },
    "sourceRefs": [{ "system": "salesforce", "id": "ACC-099" }]
  }'

# Get an entity by ID
curl -H "Authorization: Bearer dev-key" http://localhost:3002/v1/objects/<object-id>

# Test MCP tools
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/scripts run test-mcp
```

---

## Build

```bash
# Build everything
pnpm run build

# Build a specific package
pnpm --filter @acp/core run build
pnpm --filter @acp/api run build
pnpm --filter @acp/mcp-server run build
pnpm --filter @acp/templates run build
pnpm --filter @acp/infra run build
```

---

## Testing

```bash
pnpm run test
```

Runs vitest across all packages.

---

## Deployment

### Deploy to AWS

```bash
# Set environment
export ACP_ENV=dev  # or staging, prod

# Build all packages
pnpm run build

# Deploy CDK stacks
cd infra
pnpm run deploy
```

This deploys three stacks:

1. **acp-{env}-data** — VPC, RDS, Secrets Manager
2. **acp-{env}-api** — API Gateway + Lambda functions
3. **acp-{env}-mcp** — ECS Fargate + ALB + ECR

### Push MCP server Docker image

After the first deploy, push the MCP container to the ECR repository:

```bash
# Get the ECR repo URI from stack output
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name acp-dev-mcp \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepoUri'].OutputValue" \
  --output text)

# Build and push
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker build -f Dockerfile.mcp -t $ECR_URI:latest .
docker push $ECR_URI:latest

# Force new deployment
aws ecs update-service --cluster acp-dev-mcp --service <service-name> --force-new-deployment
```

### Run migrations on RDS

Connect to the RDS instance (via bastion host or SSM Session Manager) and run the migration SQL from `packages/core/src/db/migrations/001_initial_schema.sql`.

### Environment-specific configuration

| Setting | Dev | Prod |
|---------|-----|------|
| DB instance | db.t4g.medium | db.r6g.large |
| Multi-AZ | No | Yes |
| Deletion protection | No | Yes |
| Log level | debug | info |
| Fargate tasks | 1-4 | 1-4 |

---

## Architecture

### Deployment Model

The ACP deploys into your own AWS account via CDK.

Two compute targets serve different access patterns:

- **REST API on Lambda** — Data pipelines are bursty (run every 15 min, hourly, daily). Lambda scales to zero between runs. Pay per request.
- **MCP Server on ECS Fargate** — MCP expects a persistent server process. Agents call tools frequently and need fast, consistent response times without cold starts. Fargate runs a long-lived Node.js process with a warm DB connection pool.

```
AWS
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  WRITE PATH (bursty, pipeline-driven)                        │
│  ┌──────────────────────────────────────┐                    │
│  │  API Gateway HTTP API + Lambda        │                   │
│  │  POST /v1/objects                     │                   │
│  │  POST /v1/objects/bulk                │                   │
│  │  POST /v1/objects/:id/txns            │                   │
│  │  GET  /v1/objects/:id                 │                   │
│  │  GET  /v1/objects/changes             │                   │
│  │  GET  /v1/health                      │                   │
│  └──────────────────┬───────────────────┘                    │
│                      │                                       │
│  READ PATH (persistent, agent-facing)                        │
│  ┌──────────────────────────────────────┐                    │
│  │  ECS Fargate Service (MCP Server)     │                   │
│  │  ALB → Fargate task (always warm)     │                   │
│  │                                       │                   │
│  │  MCP Tools:                           │                   │
│  │  ├── get_entity                       │                   │
│  │  ├── search_entities                  │                   │
│  │  ├── get_transactions                 │                   │
│  │  ├── get_context_changes              │                   │
│  │  └── record_transaction               │                   │
│  └──────────────────┬───────────────────┘                    │
│                      │                                       │
│         Both paths share:                                    │
│  ┌──────────────────▼───────────────────────────────────┐    │
│  │  Context Engine (@acp/core)                           │    │
│  │  - Schema validation against templates                │    │
│  │  - JSONB deep merge on upsert                         │    │
│  │  - Change detection (diff previous vs new)            │    │
│  │  - Change log management                              │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  PostgreSQL RDS (with pgvector + pg_trgm extensions) │     │
│  │  ├── context_objects        (entity profiles)        │     │
│  │  ├── context_transactions   (activity history)       │     │
│  │  └── change_log             (powers changefeed)      │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

**Write Path 1 — Pipelines write entity context via REST API:**

```
Source systems (Salesforce, Snowflake, SQL)
  → your pipeline code (Airflow, Glue, Step Functions, scripts)
  → Maps source fields to canonical model shape
  → POST /v1/objects (upsert entity)
  → POST /v1/objects/:id/txns (record events)
  → Platform validates, upserts, diffs, writes change_log
```

**Write Path 2 — Agents write back decisions via MCP:**

```
Agent reasons about an entity
  → MCP tool: record_transaction
  → Platform writes to context_transactions + change_log
  → Other agents discover this on next poll
```

**Read Path 1 — On-demand agent pulls context:**

```
User: "What's happening with Acme Corp?"
  → Agent calls MCP tool: get_entity({ name: "Acme Corp" })
  → Returns full context object with recent transactions
  → Agent reasons and responds
```

**Read Path 2 — Polling agent checks for changes:**

```
Every 5 minutes, agent wakes up
  → MCP tool: get_context_changes({ since: lastPollTimestamp })
  → Returns changes with context snapshots
  → Agent evaluates, acts, writes back via record_transaction
```

**Read Path 3 — Search agent finds entities:**

```
Agent needs relevant entities
  → MCP tool: search_entities({ type: "customer", filters: {...} })
  → Returns matching entities via JSONB filters or trigram text search
```

### CDK Infrastructure Stacks

| Stack | Resources |
|-------|-----------|
| **DataStack** | VPC (public + private + isolated subnets), RDS PostgreSQL 16 (pgvector, pg_trgm), Secrets Manager (DB creds + API keys) |
| **ApiStack** | 6 Lambda functions (Node.js 20, ARM64), HTTP API Gateway with all routes, Security Groups |
| **McpStack** | ECS Fargate cluster, ECR repository, ALB, auto-scaling (1-4 tasks, 70% CPU target), CloudWatch logs |

---

## Context Object Model

### The "Facebook Profile" Pattern

Each entity is a rich, pre-joined, denormalized profile document. Pipelines do the hard work of joining and enriching data from multiple sources so agents get everything in a single call.

### Grouped Context

The context JSONB organizes facts by dimension:

```json
{
  "attributes": {},   // WHAT  — core identity facts
  "measures": {},     // HOW MUCH — quantitative data, KPIs, financials
  "actors": {},       // WHO — people, roles, ownership
  "temporals": {},    // WHEN — dates, milestones, deadlines
  "locations": {},    // WHERE — geography, channels, territories
  "intents": {},      // WHY — reasons, strategy, risk factors
  "processes": {}     // HOW — workflow state, current stage, methods
}
```

This grouping provides:
1. **Pipeline discipline** — forces curation across all dimensions, exposing gaps
2. **Agent prompt efficiency** — agents selectively attend to relevant dimensions
3. **Consistent structure** — every entity type follows the same shape

### Pre-Built Templates

| Template | Type | Transaction Types |
|----------|------|-------------------|
| `crm-customer` | entity/customer | case_opened, case_closed, qbr_completed, risk_assessed, renewal_initiated, expansion_identified, escalation_created, nps_received, contract_renewed, contract_amended, churn_warning, health_score_updated |
| `crm-contact` | entity/contact | meeting_held, email_sent, email_received, call_completed, sentiment_assessed, role_changed |
| `crm-opportunity` | entity/opportunity | stage_changed, amount_updated, meeting_scheduled, proposal_sent, contract_sent, deal_won, deal_lost, competitor_identified, risk_flagged |
| `crm-case` | entity/case | case_created, status_changed, assigned, escalated, comment_added, resolved, reopened, csat_received, sla_breached |

### Database Schema

Three tables back the platform:

- **context_objects** — Entity profiles with JSONB context, trigram name index, GIN JSONB index, pgvector embedding column, composite unique index on source reference
- **context_transactions** — Activity history linked to entities, indexed by object + time and by type + time
- **change_log** — Powers the changefeed polling pattern, indexed by changed_at for cursor-based pagination

---

## MCP Tools

The MCP server exposes 5 tools over Streamable HTTP transport:

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_entity` | Full context profile for one entity | `id` or `type` + `name` |
| `search_entities` | Find entities by filters or text | `type`, `filters` (JSONB operators: eq/gt/gte/lt/lte/contains), `query` |
| `get_transactions` | Activity history for an entity or across entities | `objectId`, `transactionTypes`, `since`, `until` |
| `get_context_changes` | Changefeed for polling agents | `since` (required), `types`, `limit` |
| `record_transaction` | Write back agent decisions | `objectId`, `transactionType`, `context`, `actors`, `measures` |

---

## REST API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/objects` | Upsert a single context object |
| `POST` | `/v1/objects/bulk` | Upsert multiple context objects (max 100) |
| `GET` | `/v1/objects/:id` | Get a context object by ID (includes last 10 transactions) |
| `POST` | `/v1/objects/:id/txns` | Record a transaction for an entity |
| `GET` | `/v1/objects/changes` | Changefeed — what changed since timestamp |
| `GET` | `/v1/health` | Health check |

Authentication: `Authorization: Bearer <api-key>` header.

### Upsert Behavior

- Deep merges new context into existing context (preserves keys not in the update)
- Arrays are replaced, not appended
- `null` values delete fields
- Computes a diff of what changed
- Writes to change_log with a context snapshot for polling agents

---

## Project Structure

```
agent-context-platform/
├── packages/
│   ├── core/                       # Shared types, DB client, engine
│   │   └── src/
│   │       ├── models/             # ContextObject, ContextTransaction, ChangeEntry, SourceReference
│   │       ├── db/
│   │       │   ├── client.ts       # pg.Pool singleton
│   │       │   ├── migrations/     # SQL schema
│   │       │   └── repositories/   # context-object.repo, transaction.repo, change-log.repo
│   │       └── engine/             # deep-merge, diff, snapshot, validator
│   ├── api/                        # REST API (Lambda handlers)
│   │   └── src/
│   │       ├── handlers/           # upsert-object, bulk-upsert, get-object, record-transaction, get-changes, health
│   │       └── middleware/         # auth, error-handler, request-logger
│   └── mcp-server/                 # MCP Server (ECS Fargate)
│       └── src/
│           └── tools/              # get-entity, search-entities, get-transactions, get-context-changes, record-transaction
├── templates/                      # Canonical model templates (customer, contact, opportunity, case)
├── infra/                          # AWS CDK (DataStack, ApiStack, McpStack)
├── scripts/                        # migrate, seed, test-mcp
├── docker-compose.yml              # Local Postgres (pgvector:pg16)
└── Dockerfile.mcp                  # MCP server container image
```

### Technology Stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 20.x |
| Monorepo | pnpm workspaces |
| Database | PostgreSQL 16 + pgvector + pg_trgm |
| DB Client | pg (no ORM) |
| Validation | ajv (templates) + zod (API requests) |
| Logging | pino (structured JSON) |
| MCP SDK | @modelcontextprotocol/sdk |
| API | Raw Lambda handlers (no Express) |
| IaC | AWS CDK (TypeScript) |
| Testing | vitest |
