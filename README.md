# Agent Context Platform (ACP)

A unified, AI-agent-optimized data store for business entity context. Instead of AI agents querying multiple operational systems (Salesforce, Snowflake, SQL databases) directly via individual MCP servers, the ACP provides a single curated context store that agents read from and write to via MCP tools.

The platform is **schema-agnostic** -- it stores whatever context JSONB it receives, deep merges it, writes change logs, and serves it to agents via MCP. Templates and validation live in the CLI, not the platform.

Three interfaces access the same data:
- **CLI** (`acp`) -- project setup, data loading, querying via REST API
- **MCP Server** -- agent-facing tools via MCP protocol
- **REST API** -- direct HTTP access for pipelines and integrations

[View interactive architecture diagram](https://htmlpreview.github.io/?https://github.com/Kartha-AI/agent-context-platform/blob/main/acp-architecture.html)

![ACP Overview](acp-overview.png)

---

## Table of Contents

- [Quick Start](#quick-start)
- [CLI Reference](#cli-reference)
- [Build](#build)
- [Testing](#testing)
- [Local Development](#local-development)
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
- **Docker** (for local Postgres, API, and MCP server)
- **AWS CLI** + **AWS CDK CLI** (for AWS deployment only)

### 1. Build and Start

```bash
# Install dependencies and build
pnpm install
pnpm run build

# Start all services (Postgres + API + MCP server)
docker compose up -d

# Verify
docker compose ps          # all 3 services healthy
curl http://localhost:3002/v1/health
```

### 2. Install the CLI

```bash
# One-time setup
pnpm setup                 # creates global bin dir (if needed)
source ~/.zshrc            # reload shell
cd packages/cli && pnpm link --global
```

After this, `acp` is available globally from any directory.

### 3. Try the Demo

```bash
# Create a demo project with sample data
acp init --demo ~/projects/acp-demo
cd ~/projects/acp-demo

# Load demo data (20 customers, 40 contacts, 50 invoices, 10 vendors)
acp connect sync

# Query
acp ctx list
acp ctx get customer "Acme Corp"
acp ctx search --type customer --filter '{"context.measures.health_score":{"lt":50}}'
acp txn list --types risk_assessed
acp changes --since 2026-03-01T00:00:00Z
```

### 4. Create Your Own Project

```bash
acp init ~/projects/my-ops       # pick context types interactively
cd ~/projects/my-ops
cp ~/downloads/customers.csv data/
acp connect add csv              # generates pipeline YAML with auto-mapping
acp connect sync                 # validates + loads data
acp ctx list                     # see what's loaded
```

---

## CLI Reference

### Project Commands

| Command | Purpose |
|---------|---------|
| `acp init <path>` | Create a project, pick context type templates |
| `acp init --demo <path>` | Create a demo project with sample data |
| `acp ctx define [type]` | Add a context type (standard or custom) |
| `acp connect add csv` | Configure a CSV/JSON data source + generate mapping |
| `acp connect list` | Show configured connectors |
| `acp connect sync` | Validate and load data into the platform |

### Query Commands

| Command | Purpose |
|---------|---------|
| `acp ctx list` | Entity counts by type |
| `acp ctx get <type> <name\|id>` | Full entity profile with recent transactions |
| `acp ctx search --type --query --filter --limit` | Search entities |
| `acp txn list --object-id --types --since --until` | List transactions |
| `acp txn add --object-id --type --context` | Record a transaction |
| `acp changes --since --types --limit` | Changefeed (what changed since timestamp) |

### Query Examples

```bash
# Stats
acp ctx list

# Get entity by name or UUID
acp ctx get customer "Acme Corp"
acp ctx get customer 550e8400-e29b-41d4-a716-446655440000

# Search with JSONB filters
acp ctx search --type customer --filter '{"context.measures.arr":{"gt":100000}}'
acp ctx search --type invoice --query "overdue"

# Transactions
acp txn list --object-id 550e8400-... --types risk_assessed --since 2026-03-01
acp txn list --types churn_warning
acp txn add --object-id 550e8400-... --type risk_assessed \
  --context '{"score":42}' --actors '{"agent":"monitor"}'

# Changefeed
acp changes --since 2026-03-28T00:00:00Z --types customer --limit 20
```

### Pipeline YAML Format

Pipeline YAMLs define how source data maps to context objects:

```yaml
source:
  type: csv
  file: data/customers.csv
target_context: customer
identity:
  source_ref_field: id
  canonical_name_field: company_name
mapping:
  attributes:
    name: company_name
    industry: industry
  measures:
    arr: annual_revenue
  temporals:
    customer_since: created_date
```

Type coercion is automatic: `measures` fields become numbers, `temporals` become ISO dates, everything else stays as strings.

---

## Build

```bash
# Build everything
pnpm run build

# Build a specific package
pnpm --filter @acp/core run build
pnpm --filter @acp/api run build
pnpm --filter @acp/mcp-server run build
pnpm --filter @kartha/acp-cli run build
pnpm --filter @acp/infra run build
```

---

## Testing

```bash
pnpm run test
```

Runs vitest across all packages.

---

## Local Development

### Docker Compose (recommended)

`docker compose up -d` starts all three services:

| Service | Port | Purpose |
|---------|------|---------|
| `db` | 5432 | PostgreSQL 16 with pgvector + pg_trgm |
| `api` | 3002 | REST API (auto-runs migrations on startup) |
| `mcp` | 3001 | MCP server (Streamable HTTP transport) |

```bash
docker compose up -d          # start all
docker compose ps             # check status
docker compose logs api       # view API logs
docker compose down           # stop all (data persists in volume)
docker compose up -d --build  # rebuild after code changes
```

Data persists in the `acp-data` Docker volume across restarts.

### Manual (without Docker for API/MCP)

If you prefer running API and MCP outside Docker:

```bash
# Start just Postgres
docker compose up db -d

# Run migrations
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/core run migrate

# Start API (dev mode with hot reload)
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp PORT=3002 pnpm --filter @acp/api run dev

# Start MCP server (dev mode with hot reload)
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/mcp-server run dev
```

### MCP Transport Modes

The MCP server supports two transports:

**Streamable HTTP (default)** -- for remote agents and Claude.ai:
```json
{ "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
```

**stdio** -- for Claude Desktop local:
```json
{
  "mcpServers": {
    "acp": {
      "command": "node",
      "args": ["<repo>/packages/mcp-server/dist/index.js"],
      "env": {
        "ACP_MCP_TRANSPORT": "stdio",
        "DATABASE_URL": "postgresql://acp:localdev@localhost:5432/acp"
      }
    }
  }
}
```

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

1. **acp-{env}-data** -- VPC, RDS PostgreSQL, Secrets Manager
2. **acp-{env}-api** -- API Gateway + Lambda functions
3. **acp-{env}-mcp** -- ECS Fargate + ALB + ECR

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

[View interactive architecture diagram](https://htmlpreview.github.io/?https://github.com/Kartha-AI/agent-context-platform/blob/main/acp-architecture.html)

### Design Principles

- **Platform is schema-agnostic.** It stores and serves JSONB context objects without opinion on schema. Templates and validation live in the CLI.
- **API and MCP both use `@acp/core` directly.** Same repositories, same engine, same DB connection pool. No HTTP hop between them.
- **CLI is a pure HTTP client.** It talks to the REST API. No `@acp/core` dependency.

### Deployment Model

```
                         ┌─────────────────────────────────┐
                         │  @acp/core (shared library)      │
                         │  models, repositories, engine    │
                         │  deep-merge, diff, snapshot      │
                         │  pg.Pool connection              │
                         └──────────┬──────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  Postgres :5432      │
                         │  context_objects     │
                         │  context_transactions│
                         │  change_log          │
                         └──────────▲──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │                               │
          ┌─────────┴──────────┐         ┌─────────┴──────────┐
          │  REST API :3002    │         │  MCP Server :3001   │
          │  uses @acp/core    │         │  uses @acp/core     │
          │  direct DB access  │         │  direct DB access   │
          └─────────▲──────────┘         └─────────▲──────────┘
                    │                               │
                    │ HTTP                          │ MCP protocol
                    │                               │
          ┌─────────┴──────────┐         ┌─────────┴──────────┐
          │  CLI               │         │  Claude Desktop     │
          │  acp connect sync  │         │  Cursor, agents     │
          │  acp ctx get       │         │  any MCP client     │
          │  acp txn list      │         │                     │
          │  (HTTP client only)│         │                     │
          └────────────────────┘         └────────────────────┘
```

### Data Flow

**Write Path 1 -- Pipelines write entity context via CLI or REST API:**

```
Source data (CSV, JSON, databases)
  → acp connect sync (CLI validates against templates, maps fields)
  → POST /v1/objects/bulk (REST API)
  → Platform deep merges, diffs, writes change_log
```

**Write Path 2 -- Agents write back decisions via MCP:**

```
Agent reasons about an entity
  → MCP tool: record_transaction
  → Platform writes to context_transactions + change_log
  → Other agents discover this on next poll
```

**Read Path 1 -- On-demand agent pulls context:**

```
User: "What's happening with Acme Corp?"
  → Agent calls MCP tool: get_entity({ name: "Acme Corp" })
  → Returns full context object with recent transactions
```

**Read Path 2 -- Polling agent checks for changes:**

```
Every 5 minutes, agent wakes up
  → MCP tool: get_context_changes({ since: lastPollTimestamp })
  → Returns changes with context snapshots
  → Agent evaluates, acts, writes back via record_transaction
```

---

## Context Object Model

### The "Facebook Profile" Pattern

Each entity is a rich, pre-joined, denormalized profile document. Pipelines do the hard work of joining and enriching data from multiple sources so agents get everything in a single call.

### Grouped Context

The context JSONB organizes facts by dimension:

```json
{
  "attributes": {},   // WHAT  -- core identity facts
  "measures": {},     // HOW MUCH -- quantitative data, KPIs, financials
  "actors": {},       // WHO -- people, roles, ownership
  "temporals": {},    // WHEN -- dates, milestones, deadlines
  "locations": {},    // WHERE -- geography, channels, territories
  "intents": {},      // WHY -- reasons, strategy, risk factors
  "processes": {}     // HOW -- workflow state, current stage, methods
}
```

### Standard Templates

10 templates ship with the CLI in `packages/cli/standard-templates/`:

| Template | Type | Category |
|----------|------|----------|
| `crm-customer` | entity/customer | CRM |
| `crm-contact` | entity/contact | CRM |
| `crm-opportunity` | entity/opportunity | CRM |
| `crm-case` | entity/case | CRM |
| `crm-vendor` | entity/vendor | CRM |
| `finance-invoice` | entity/invoice | Finance |
| `legal-contract` | entity/contract | Legal |
| `logistics-shipment` | entity/shipment | Logistics |
| `catalog-product` | entity/product | Catalog |
| `hr-employee` | entity/employee | HR |

Templates are YAML files that define fields, types, enums, and allowed transaction types. `acp init` copies selected templates into your project's `contexts/` directory where they can be customized.

### Database Schema

Three tables back the platform:

- **context_objects** -- Entity profiles with JSONB context, trigram name index, GIN JSONB index, pgvector embedding column, composite unique index on source reference
- **context_transactions** -- Activity history linked to entities, indexed by object + time and by type + time
- **change_log** -- Powers the changefeed polling pattern, indexed by changed_at for cursor-based pagination

---

## MCP Tools

The MCP server exposes 5 tools. Supports both Streamable HTTP and stdio transports.

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
| `GET` | `/v1/objects/stats` | Entity counts grouped by type |
| `GET` | `/v1/objects/search` | Search by type, text, JSONB filters |
| `GET` | `/v1/objects/:id` | Get a context object by ID (includes last 10 transactions) |
| `GET` | `/v1/objects/:id/txns` | Get transactions for an entity |
| `POST` | `/v1/objects/:id/txns` | Record a transaction for an entity |
| `GET` | `/v1/objects/txns` | Query transactions across all entities |
| `GET` | `/v1/objects/changes` | Changefeed -- what changed since timestamp |
| `GET` | `/v1/health` | Health check |

Authentication: `Authorization: Bearer <api-key>` header. All endpoints except `/v1/health`.

### Search Parameters

`GET /v1/objects/search`:

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by subtype (e.g., `customer`) |
| `query` | string | Text search on canonical_name |
| `filters` | JSON string | JSONB path filters (e.g., `{"context.measures.arr":{"gt":100000}}`) |
| `limit` | number | Max results (default 10, max 100) |
| `offset` | number | Pagination offset |

Supported filter operators: `eq`, `gt`, `gte`, `lt`, `lte`, `contains`

### Upsert Behavior

- Schema-agnostic: accepts any JSONB context structure
- Deep merges new context into existing (preserves keys not in the update)
- Arrays are replaced, not appended
- `null` values delete fields
- Computes a diff of what changed
- Writes to change_log with a context snapshot for polling agents

---

## Project Structure

```
acp/
├── packages/
│   ├── core/                       # Shared types, DB client, engine
│   │   └── src/
│   │       ├── models/             # ContextObject, ContextTransaction, ChangeEntry, SourceReference
│   │       ├── db/
│   │       │   ├── client.ts       # pg.Pool singleton
│   │       │   ├── migrate.ts      # runMigrations() + standalone runner
│   │       │   ├── migrations/     # SQL schema
│   │       │   └── repositories/   # context-object.repo, transaction.repo, change-log.repo
│   │       └── engine/             # deep-merge, diff, snapshot, validator
│   ├── api/                        # REST API
│   │   └── src/
│   │       ├── handlers/           # upsert-object, bulk-upsert, get-object, get-stats,
│   │       │                       # search-objects, record-transaction, get-changes,
│   │       │                       # get-entity-transactions, get-transactions-query, health
│   │       ├── middleware/         # auth, error-handler, request-logger
│   │       ├── local-server.ts    # HTTP server for Docker (auto-migrates on startup)
│   │       └── dev-server.ts      # Dev server with hot reload
│   ├── mcp-server/                 # MCP Server (HTTP + stdio transports)
│   │   └── src/
│   │       ├── tools/              # get-entity, search-entities, get-transactions,
│   │       │                       # get-context-changes, record-transaction
│   │       ├── server.ts           # MCP tool registration
│   │       └── index.ts            # Transport selection (HTTP or stdio)
│   └── cli/                        # CLI (`acp` command)
│       ├── src/
│       │   ├── commands/           # init, ctx-*, txn-*, changes, connect-*
│       │   ├── util/               # config, api-client, template-loader, validator, format
│       │   ├── connectors/         # CSV/JSON/JSONL extractor
│       │   ├── pipelines/          # YAML parser, mapper, auto-mapper
│       │   └── demo/              # Demo CSVs + pipeline YAMLs
│       └── standard-templates/    # 10 YAML templates (CRM, finance, legal, logistics, catalog, HR)
├── templates/                      # Legacy TypeScript templates (reference only)
├── infra/                          # AWS CDK (DataStack, ApiStack, McpStack)
├── scripts/                        # migrate, seed, test-mcp
├── docker-compose.yml              # Postgres + API + MCP server
├── Dockerfile.api                  # API container image
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
| Validation | zod (API requests, CLI config) |
| Logging | pino (structured JSON) |
| MCP SDK | @modelcontextprotocol/sdk |
| CLI | commander + inquirer + chalk |
| API | Raw Lambda handlers (no Express) |
| IaC | AWS CDK (TypeScript) |
| Testing | vitest |
