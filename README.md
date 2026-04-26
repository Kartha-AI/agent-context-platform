# Agent Context Platform (ACP)

### AI-enable your business — with the data and systems you already have.
*No new apps. No starting from scratch. Pre-built context, ready for any AI agent in minutes.*

🚀 **[Get started in 10 minutes](#-quick-start)** · 🏗️ [Architecture](#️-architecture) · 🧠 [Pre-Built Skills](#-pre-built-skills) · 💻 [CLI Reference](#-cli-reference) · 🔄 [Loading Data at Scale](#-loading-data-at-scale) · ❓ [FAQ](reference/FAQ.md)

<p align="center">
  <img src="reference/acp-intro.png" alt="ACP Overview" width="100%"/>
</p>

---

## 🚀 Quick Start

Get from zero to "Claude is reasoning over your business data" in under 10 minutes.

### Prerequisites

- **Node.js** 20.x — `brew install node@20` (Mac) · `nvm install 20` (any OS) · [download](https://nodejs.org/)
- **pnpm** — `npm install -g pnpm`
- **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Windows) or `apt install docker.io` (Linux). Make sure it's running.
- **Claude Desktop** (optional, for step 3) — [download](https://claude.ai/download)

> First time using `pnpm` global packages? Run `pnpm setup && source ~/.zshrc` once before step 1 so pnpm can create its global bin directory.

### 1. Clone and Set Up

```bash
git clone https://github.com/Kartha-AI/agent-context-platform
cd agent-context-platform
./setup.sh
```

`setup.sh` installs dependencies, builds packages, starts the platform (Postgres + REST API + MCP server in Docker), and links the `acp` CLI globally. When it finishes, `acp` is available from any directory and the platform is running on:

- Postgres → `localhost:5432`
- REST API → `localhost:3002`
- MCP server → `localhost:3001`

### 2. Load the Demo (2 minutes)

The demo ships with 20 customers, contacts, invoices, and vendors. Five of the customers have dramatic risk stories — biggest account in worst shape, departed champions, ghost accounts, stalled onboarding — so the agent has something interesting to reason about.

```bash
acp init --demo ~/projects/acp-demo
cd ~/projects/acp-demo
acp connect sync
```

Try a few queries from the CLI:

```bash
acp ctx list                                                    # entity counts by type
acp ctx get customer "Pinnacle Industries"                      # full profile, all 7 dimensions
acp ctx search --type customer \
  --filter '{"context.measures.health_score":{"lt":50}}'        # at-risk customers
acp ctx search --type invoice \
  --filter '{"context.attributes.status":{"eq":"overdue"}}'     # overdue invoices
acp changes --since 2026-03-01T00:00:00Z                        # changefeed
```

### 3. Connect Claude Desktop

One command wires up Claude Desktop:

```bash
acp setup claude-desktop
```

This locates your `claude_desktop_config.json`, detects the ACP repo, adds the MCP server entry, and prints next steps. Restart Claude Desktop (`Cmd+Q` then reopen) and you're ready.

Also supported:

```bash
acp setup cursor          # writes .cursor/mcp.json in the current directory
acp setup claude-code     # writes .mcp.json in the current directory
```

<details>
<summary>Manual Claude Desktop config (if you prefer)</summary>

```json
{
  "mcpServers": {
    "acp": {
      "command": "node",
      "args": ["{path-to-acp}/packages/mcp-server/dist/index.js"],
      "env": {
        "ACP_MCP_TRANSPORT": "stdio",
        "DATABASE_URL": "postgresql://acp:localdev@localhost:5432/acp"
      }
    }
  }
}
```

Replace `{path-to-acp}` with the absolute path to your cloned repo.
</details>

**For a structured analyst persona**, create a new Claude Desktop Project and paste [`skills/quickstart/claude-project.md`](skills/quickstart/claude-project.md) as the system prompt. The agent will know how to navigate the 7-dimension schema before its first message.

**Then ask Claude:**

> "I'm taking over customer success today. Brief me on our riskiest accounts — what's happening with each one and what should I do first?"

> "Pinnacle Industries is our biggest account. What's their full picture?"

> "Which customers have renewals in the next 90 days and are showing risk signals?"

> "Show me at-risk customers that also have overdue invoices."

The last one is the "wow" moment — Claude joins customer health with collections data in a single call, no manual cross-referencing.

### 4. Load Your Own Data

```bash
acp init ~/projects/my-ops       # pick context types interactively
cd ~/projects/my-ops
cp ~/downloads/customers.csv data/
acp connect add csv              # generates pipeline YAML with auto-mapping
acp connect sync                 # validates + loads data
acp ctx list                     # see what's loaded
```

Pipelines are YAML — version-control them alongside your project. See [Pipeline YAML Format](#pipeline-yaml-format) below.

> **Enterprise data at scale?** For loading 100M+ rows from Snowflake, BigQuery, or your data warehouse — with partitioned extract, parallel workers, staging tables, and set-based promote — see the dedicated [acp-pipeline-reference](https://github.com/Kartha-AI/acp-pipeline-reference) repo. It's a production-grade pipeline pattern you fork and adapt to your sources. More in [Loading Data at Scale](#-loading-data-at-scale) below.

---

## 📑 Table of Contents

- [💡 Why ACP?](#-why-acp)
- [⚙️ How It Works](#️-how-it-works)
- [🧠 Pre-Built Skills](#-pre-built-skills)
- [💻 CLI Reference](#-cli-reference)
- [🏗️ Architecture](#️-architecture)
- [📐 Context Object Model](#-context-object-model)
- [🔌 MCP Tools](#-mcp-tools)
- [🌐 REST API](#-rest-api)
- [🚀 Loading Data at Scale](#-loading-data-at-scale)
- [☁️ Deployment](#️-deployment)
- [🛠️ Local Development](#️-local-development)
- [📁 Project Structure](#-project-structure)
- [🔄 Schema Evolution](#-schema-evolution)
- [❓ FAQ](FAQ.md)

---

## 💡 Why ACP?

**The agent is the easy part. Context is the hard part.**

Today, building a useful AI agent means wiring up connectors to every system — CRM, billing, support, ERP — then writing code to pull, normalize, and stitch data together so the agent has enough context to give a useful answer. It's cumbersome, fragile, and different for every agent you build. ACP eliminates that work. Your business data is loaded once, organized into structured context profiles, and served to any agent — pre-built, pre-joined, ready to reason on.

The difference: ACP doesn't push the integration problem onto the agent — it solves it once, ahead of time. Pipelines pull and normalize your data before any agent asks a question. The result is pre-built, structured context stored in Postgres — reusable by any agent, any framework, any number of times. The 10th agent doesn't re-integrate. The 100th question doesn't re-pull. Build context once, use it everywhere. ACP provides the infrastructure around that context — MCP server, REST API, CLI, changefeed, transaction history — so any agent can connect and start reasoning immediately.

Kartha ACP is the context layer that makes agents useful:

- **Extract** from any system — CRM, billing, support, ERP, spreadsheets, databases, enterprise APIs
- **Curate** into structured 7-dimension context profiles (what, how much, who, when, where, why, how)
- **Serve** to any AI agent via MCP or CLI in a single call
- **Extend** with your own context types — customers, invoices, fleet vehicles, clinical trials, anything
- **Automate** with pre-built skills that monitor, assess, and act — continuously, not just when you ask

*Uploading a spreadsheet to Claude works for one-off questions — ACP is for when you need persistent, cross-system context that multiple agents, people, and teams across your business share continuously. ([More in FAQ](reference/FAQ.md#cant-i-just-upload-a-spreadsheet-to-claude-or-chatgpt-and-ask-questions))*

```
Your data (CRM, billing, support, ERP, spreadsheets, any system)
  → ACP curates into 7-dimension context profiles
  → Agents query via MCP: "What's happening with Acme Corp?"
  → One call returns everything, organized by dimension:
      attributes:  WHAT     — name: Acme Corp, industry: SaaS, segment: enterprise
      measures:    HOW MUCH — ARR $480K, health score 34, NPS 28
      actors:      WHO      — owner: Sarah Chen, contact: Jane Lee
      temporals:   WHEN     — renewal in 45 days, last QBR 3 months ago
      locations:   WHERE    — region: West, territory: US-Pacific
      intents:     WHY      — churn risk HIGH, expansion potential LOW
      processes:   HOW      — onboarding complete, support tier premium
```

Ships with 10 standard context types and 5 APQC-based business skills. Or define your own with a YAML template. Open source. Runs locally via Docker Compose. Deploys to AWS/GCP for teams to share context across agents and people. For loading enterprise data at scale, see [acp-pipeline-reference](https://github.com/Kartha-AI/acp-pipeline-reference) — a production-grade reference pipeline for warehouse-scale ingestion.

Every AI agent framework — CrewAI, LangGraph, AutoGen, Mastra, Claude, GPT — has the same unsolved problem: **where does the agent get good business context?**

| Current approach | Problem |
|-----------------|---------|
| Individual MCP servers per system | Fragmented context, no cross-system reasoning |
| Vector databases | Unstructured dumps, no canonical schema |
| Raw API calls from agents | Inconsistent, slow, no pre-joined context |
| CDPs (Segment, RudderStack) | Customer-only, marketing-focused |

ACP solves this the way Snowflake solved analytics: extract, curate, serve. Except instead of SQL for analysts, ACP serves MCP tools for agents.

### Without ACP: One MCP server per system

```
Claude Desktop connects to:
  → hubspot-mcp-server    (deals, companies)
  → stripe-mcp-server     (payments, subscriptions)
  → zendesk-mcp-server    (tickets, satisfaction)

User: "Is Acme Corp at risk?"

Agent makes 3 separate tool calls, gets 3 different data shapes,
then tries to correlate by company name (fuzzy, unreliable).
No unified health score. No single view. Burns tokens on JOINs.
```

### With ACP: One call, everything joined

```
User: "Is Acme Corp at risk?"

Agent calls: get_entity({ name: "Acme Corp" })

Returns ONE pre-joined profile:
  measures:  { arr: 480000, health_score: 34, nps: 28, open_cases: 3 }
  temporals: { renewal_date: "2026-05-15", last_qbr: "2026-01-10" }
  actors:    { owner: "Sarah Chen", primary_contact: "Jane Lee" }
  intents:   { churn_risk: "high", expansion_potential: "low" }

Data from HubSpot + Stripe + Zendesk, already joined by the pipeline.
Agent reasons on structured, typed, reliable data. One call. No guesswork.
```

### What standardization gives you

- **Agent portability** -- Switch from HubSpot to Salesforce? Change the pipeline YAML. Agent code doesn't change.
- **Template reuse** -- Company A's risk assessment agent works at Company B. Same schema, different pipeline.
- **Proactive agents** -- Agents poll `get_context_changes` and act on changes autonomously. Health score drops? Agent creates a risk assessment.
- **Agent-to-agent coordination** -- Agents coordinate through data: Agent A writes `risk_assessed`, Agent B sees it on the changefeed and creates an escalation.

---

## ⚙️ How It Works

**The platform** runs as Docker containers (Postgres + REST API + MCP server). It's schema-agnostic -- stores any JSONB context, deep merges it, tracks changes.

**Your project** is a separate directory with context type definitions, field mappings, and data files. The CLI validates and loads data into the running platform.

**Three interfaces** access the same data:

```
Developer's project                    Running ACP Platform
┌────────────────────────┐            ┌───────────────────────────┐
│  contexts/*.yaml       │            │  Docker Compose           │
│  pipelines/*.yaml      │            │  ├── Postgres  :5432      │
│  data/*.csv            │  HTTP POST │  ├── REST API  :3002      │
│  acp.yaml              │            │  └── MCP Server :3001     │
│                        │            │                           │
│  CLI: validate + map ──┼────────────┼──→ /v1/objects            │
└────────────────────────┘            └──────────────┬────────────┘
                                                     │
                                          AI Agents connect
                                          via MCP :3001
```

**Two ways to use it** -- ad-hoc questions and structured skills:

```
Ad-hoc (just ask):                       Skills (structured workflows):

"What's happening with Acme Corp?"       "Run the customer health monitor"
  → Agent calls get_entity                → Agent follows a defined workflow
  → Reads the response                    → Polls changefeed for changes
  → Reasons and answers                   → Assesses each customer against rules
  → Nothing recorded                      → Records risk_assessed transactions
                                          → Other agents can act on those results
No setup needed. No skill required.
Connect an agent and ask.                Repeatable. Consistent. Builds history.
```

---

## 🧠 Pre-Built Skills

Skills are pre-built agent workflows that run on top of ACP data. They provide the business logic -- what to check, how to assess, what to record. Your agent runtime (Claude Desktop, CrewAI, LangGraph) runs the skill. ACP provides the data.

| Skill | APQC Process | Context Types | What It Does |
|-------|-------------|---------------|--------------|
| **Quickstart Analyst** | — | any | General-purpose business analyst prompt — paste into a Claude Project to start exploring data |
| **Customer Health Monitor** | 3.3.4 Manage Customer Health | customer, case | Polls changefeed, classifies risk (critical/high/medium/low), records `risk_assessed` |
| **Pipeline Risk Assessment** | 3.2.5 Manage Sales Pipeline | opportunity, customer | Flags stale deals, missing context, overvalued pipeline, records `deal_risk_assessed` |
| **Invoice Collections Tracker** | 8.3.4 Manage Collections | invoice, customer | Finds overdue invoices, groups by aging bracket, cross-references customer health |
| **Case Escalation Monitor** | 5.2.3 Manage Escalations | case, customer | Context-aware escalation using ARR, health score, renewal date |
| **Vendor Performance Review** | 11.1.3 Assess Vendor Performance | vendor, invoice, contract | Scores vendors on delivery/quality/commercial/relationship |

Each skill is a directory with a prompt, metadata, and framework-specific examples:

```
skills/customer-health-monitor/
├── skill.yaml              # metadata: context types, triggers, APQC reference
├── prompt.md               # the agent prompt (framework-agnostic)
├── README.md               # documentation + CLI equivalents
└── examples/
    ├── claude-project.md   # paste into Claude Desktop Project
    └── crewai-agent.py     # ready-to-use CrewAI agent
```

**Using a skill with Claude Desktop:**
1. Connect ACP MCP server (see Quick Start step 4)
2. Create a new Project in Claude Desktop
3. Paste `skills/<skill>/examples/claude-project.md` into the system prompt
4. Ask: "Check customer health" or "Run the health monitor"

---

## 💻 CLI Reference

### Project Commands

| Command | Purpose |
|---------|---------|
| `acp init <path>` | Create a project, pick context type templates |
| `acp init --demo <path>` | Create a demo project with sample data |
| `acp ctx define [type]` | Add a context type (standard or custom) |
| `acp connect add csv` | Configure a CSV/JSON data source + generate mapping |
| `acp connect list` | Show configured connectors |
| `acp connect sync` | Validate and load data into the platform |
| `acp setup claude-desktop` | Auto-configure Claude Desktop to use the ACP MCP server |
| `acp setup cursor` | Write `.cursor/mcp.json` for Cursor in current directory |
| `acp setup claude-code` | Write `.mcp.json` for Claude Code in current directory |

### Query Commands

| Command | MCP Equivalent | Purpose |
|---------|---------------|---------|
| `acp ctx list` | -- | Entity counts by type |
| `acp ctx get <type> <name\|id>` | `get_entity` | Full entity profile with recent transactions |
| `acp ctx search --type --query --filter --limit` | `search_entities` | Search entities |
| `acp txn list --object-id --types --since --until` | `get_transactions` | List transactions |
| `acp txn add --object-id --type --context` | `record_transaction` | Record a transaction |
| `acp changes --since --types --limit` | `get_context_changes` | Changefeed |

### Pipeline YAML Format

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

## 🏗️ Architecture

![ACP Overview](reference/acp-overview.png)

[View interactive architecture diagram](https://htmlpreview.github.io/?https://github.com/Kartha-AI/agent-context-platform/blob/main/reference/acp-architecture.html)

### Design Principles

- **Platform is schema-agnostic.** Stores and serves JSONB context objects without opinion on schema. Templates and validation live in the CLI.
- **API and MCP both use `@acp/core` directly.** Same repositories, same engine, same DB connection pool. No HTTP hop between them.
- **CLI is a pure HTTP client.** Talks to the REST API. No `@acp/core` dependency. Works against local or remote deployments.

### Component Diagram

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
          └────────────────────┘         └────────────────────┘
```

### Data Flow

**Write Path 1 -- Pipelines write via CLI or REST API:**
```
Source data (CSV, JSON) → acp connect sync → POST /v1/objects/bulk → deep merge, diff, change_log
```

**Write Path 2 -- Agents write back via MCP:**
```
Agent reasons → record_transaction → context_transactions + change_log → other agents discover on next poll
```

**Read Path 1 -- On-demand:** Agent calls `get_entity`, gets full profile with recent transactions.

**Read Path 2 -- Polling:** Agent calls `get_context_changes({ since })`, processes changes, writes back decisions.

---

## 📐 Context Object Model

### 7-Dimension Schema

Every entity's context is organized into 7 semantic dimensions. Agents don't parse flat fields -- they navigate structured context:

```json
{
  "attributes": {},   // WHAT  -- core identity (name, industry, status)
  "measures": {},     // HOW MUCH -- numbers (ARR, health score, NPS)
  "actors": {},       // WHO -- people (owner, contact, stakeholders)
  "temporals": {},    // WHEN -- dates (renewal, last activity, SLA deadline)
  "locations": {},    // WHERE -- geography (region, timezone)
  "intents": {},      // WHY -- strategy (churn risk, expansion potential)
  "processes": {}     // HOW -- workflow (stage, onboarding status)
}
```

| Agent task | Dimensions used | What the agent finds |
|-----------|----------------|---------------------|
| "Is this customer at risk?" | measures + intents + temporals | health_score: 34, churn_risk: high, renewal in 45 days |
| "Who should I contact?" | actors + attributes | primary_contact: Jane Lee, owner: Sarah Chen |
| "What's the financial picture?" | measures | ARR: $480K, open_cases: 3, NPS: 28 |
| "How urgent is this?" | temporals + processes | renewal in 45 days, onboarding: completed |

### Standard Templates

10 templates ship with the CLI in `packages/cli/standard-templates/`:

| Template | Category | Description |
|----------|----------|-------------|
| `crm-customer` | CRM | Customer/account with sales, support, financial context |
| `crm-contact` | CRM | Contact with role, engagement, sentiment |
| `crm-opportunity` | CRM | Sales deal with stage, value, probability |
| `crm-case` | CRM | Support ticket with priority, SLA, resolution |
| `crm-vendor` | CRM | Vendor with performance, spend, compliance |
| `finance-invoice` | Finance | Invoice with billing, payments, collections |
| `legal-contract` | Legal | Contract with terms, renewals, expiration |
| `logistics-shipment` | Logistics | Shipment with tracking, delivery, customs |
| `catalog-product` | Catalog | Product with inventory, pricing, availability |
| `hr-employee` | HR | Employee with performance, tenure, development |

### Database Schema

Three tables back the platform:

- **context_objects** -- Entity profiles with JSONB context, trigram name index, GIN JSONB index, pgvector embedding column
- **context_transactions** -- Activity history linked to entities, indexed by object + time and by type + time
- **change_log** -- Powers the changefeed, indexed by changed_at for cursor-based pagination

---

## 🔌 MCP Tools

5 tools over Streamable HTTP transport:

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_entity` | Full context profile for one entity | `id` or `type` + `name` |
| `search_entities` | Find entities by filters or text | `type`, `filters`, `query`, `limit` |
| `get_transactions` | Activity history | `objectId`, `transactionTypes`, `since`, `until` |
| `get_context_changes` | Changefeed for polling agents | `since` (required), `types`, `limit` |
| `record_transaction` | Write back agent decisions | `objectId`, `transactionType`, `context` |

Filter operators: `eq`, `gt`, `gte`, `lt`, `lte`, `contains`

---

## 🌐 REST API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/objects` | Upsert a single context object |
| `POST` | `/v1/objects/bulk` | Upsert multiple (max 100) |
| `GET` | `/v1/objects/stats` | Entity counts grouped by type |
| `GET` | `/v1/objects/search` | Search by type, text, JSONB filters |
| `GET` | `/v1/objects/:id` | Get entity by ID (includes last 10 transactions) |
| `GET` | `/v1/objects/:id/txns` | Get transactions for an entity |
| `POST` | `/v1/objects/:id/txns` | Record a transaction |
| `GET` | `/v1/objects/txns` | Query transactions across all entities |
| `GET` | `/v1/objects/changes` | Changefeed |
| `GET` | `/v1/health` | Health check |

Authentication: `Authorization: Bearer <api-key>`. All endpoints except `/v1/health`.

**Upsert behavior:** Schema-agnostic. Deep merges new context into existing. Arrays replaced, not appended. `null` deletes fields. Computes diff, writes to change_log.

---

## 🚀 Loading Data at Scale

For most use cases — CSVs, JSON files, modest API pulls — the built-in CLI connectors and `acp connect sync` handle ingestion well. Pipelines are YAML, validation happens locally, data goes through `/v1/objects/bulk`.

For **enterprise-scale loads** (hundreds of millions of rows from data warehouses), `/bulk` alone isn't the right tool. You need:

- **Partitioned extraction** so the load runs in parallel
- **Streaming** so a single worker doesn't OOM on a 50M-row partition
- **Staging tables** so failures don't force a full re-extract from the warehouse
- **Set-based promote** so the final commit is one fast SQL transaction, not 50M HTTP calls
- **Two-mode design** — bulk SQL promote for initial backfills, `/bulk` drainer for ongoing incremental sync

These are pipeline concerns, not platform concerns. ACP exposes the contracts (`/bulk`, the context_objects schema, the 7-dimension shape) and lets you build the pipeline that fits your stack.

### The reference pipeline

We've shipped a production-grade reference pipeline as a separate repo:

**🔗 [github.com/Kartha-AI/acp-pipeline-reference](https://github.com/Kartha-AI/acp-pipeline-reference)**

It's a TypeScript monorepo with:

- A **source-agnostic pipeline framework** — pluggable `SourceConnector` interface, shared staging + promote + drain
- A working **Postgres connector** with TPC-H sample data so you can run end-to-end locally
- A **Snowflake connector skeleton** showing how to add new sources (1-2 weeks of work for a senior engineer)
- **Two-mode design:** SQL promote for 100M+ row backfills (~50k rows/sec), `/bulk` drainer for incremental sync
- **AWS-native infrastructure:** ECS Fargate extractors, Step Functions orchestration, AWS CDK
- **Operational runbooks:** deployment, initial load, incremental sync, adding connectors, troubleshooting

Customers fork the repo, swap in their connector and transformer for their domain, and have a working enterprise pipeline against their stack. ACP Core is unchanged — the pipeline is purely a consumer of the documented contracts.

### When to use which

| Scenario | Approach |
|---|---|
| CSVs, JSON files, simple API pulls | Built-in CLI connectors (`acp connect add csv`) |
| Modest production pipelines (< 1M rows) | Custom code calling `POST /v1/objects/bulk` directly |
| Enterprise warehouse loads (100M+ rows) | Fork [acp-pipeline-reference](https://github.com/Kartha-AI/acp-pipeline-reference), adapt connectors |
| Real-time event streams | Build your own: Kafka consumer → /bulk in batches |

The platform contract is the same in all cases. Only the pipeline shape changes.

---

## ☁️ Deployment

### Local (development)

```bash
docker compose up -d
# API at localhost:3002, MCP at localhost:3001
```

### Server (always-on agent)

Same Docker Compose on any Linux server:

```bash
ssh myserver
git clone https://github.com/Kartha-AI/agent-context-platform
cd agent-context-platform && docker compose up -d
```

### AWS (team deployment)

```bash
export ACP_ENV=prod
cd infra && pnpm run deploy
```

Deploys three stacks:
1. **acp-{env}-data** -- VPC, RDS PostgreSQL, Secrets Manager
2. **acp-{env}-api** -- API Gateway + Lambda functions
3. **acp-{env}-mcp** -- ECS Fargate + ALB + ECR

---

## 🛠️ Local Development

### Docker Compose (recommended)

| Service | Port | Purpose |
|---------|------|---------|
| `db` | 5432 | PostgreSQL 16 with pgvector + pg_trgm |
| `api` | 3002 | REST API (auto-runs migrations on startup) |
| `mcp` | 3001 | MCP server (Streamable HTTP) |

```bash
docker compose up -d          # start all
docker compose ps             # check status
docker compose logs api       # view logs
docker compose down           # stop (data persists)
docker compose up -d --build  # rebuild after code changes
```

### Manual (without Docker for API/MCP)

```bash
docker compose up db -d
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/core run migrate
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp PORT=3002 pnpm --filter @acp/api run dev
DATABASE_URL=postgresql://acp:localdev@localhost:5432/acp pnpm --filter @acp/mcp-server run dev
```

### Build

```bash
pnpm run build                          # everything
pnpm --filter @acp/core run build       # one package
pnpm --filter @kartha/acp-cli run build
```

### Testing

```bash
pnpm run test
```

### Local Testing

Import [`acp-postman-collection.json`](reference/acp-postman-collection.json) into Postman for a ready-to-use collection covering all REST API and MCP endpoints. Run "Upsert Object" first (auto-saves the object ID), then "Initialize Session" for MCP requests.

#### curl examples

Once `docker compose up -d` is running, test the REST API and MCP server directly.

#### REST API (port 3002)

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
    "canonicalName": "Test Corp",
    "context": {
      "attributes": { "name": "Test Corp", "industry": "Technology", "status": "active" },
      "measures": { "arr": 250000, "health_score": 72 },
      "actors": { "owner": "Jane Smith" },
      "temporals": { "renewal_date": "2026-12-01" }
    },
    "sourceRefs": [{ "system": "test", "id": "T001" }]
  }'

# Get entity by ID (use the objectId from the upsert response)
curl -H "Authorization: Bearer dev-key" \
  http://localhost:3002/v1/objects/<objectId>

# Entity counts by type
curl -H "Authorization: Bearer dev-key" \
  http://localhost:3002/v1/objects/stats

# Search by type
curl -H "Authorization: Bearer dev-key" \
  "http://localhost:3002/v1/objects/search?type=customer"

# Search with JSONB filter
curl -H "Authorization: Bearer dev-key" \
  "http://localhost:3002/v1/objects/search?type=customer&filters=%7B%22context.measures.arr%22%3A%7B%22gt%22%3A100000%7D%7D"

# Record a transaction
curl -X POST http://localhost:3002/v1/objects/<objectId>/txns \
  -H "Authorization: Bearer dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "risk_assessed",
    "context": { "risk_level": "medium", "score": 65, "factors": ["Health score declining"] },
    "actors": { "agent": "manual-test" }
  }'

# Get transactions for an entity
curl -H "Authorization: Bearer dev-key" \
  "http://localhost:3002/v1/objects/<objectId>/txns"

# Get transactions across all entities
curl -H "Authorization: Bearer dev-key" \
  "http://localhost:3002/v1/objects/txns?types=risk_assessed"

# Changefeed -- what changed since a timestamp
curl -H "Authorization: Bearer dev-key" \
  "http://localhost:3002/v1/objects/changes?since=2026-01-01T00:00:00Z"

# Bulk upsert
curl -X POST http://localhost:3002/v1/objects/bulk \
  -H "Authorization: Bearer dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "objects": [
      {
        "objectType": "entity", "subtype": "customer", "canonicalName": "Alpha Inc",
        "context": { "attributes": { "name": "Alpha Inc" }, "measures": { "arr": 100000 } },
        "sourceRefs": [{ "system": "test", "id": "T002" }]
      },
      {
        "objectType": "entity", "subtype": "customer", "canonicalName": "Beta LLC",
        "context": { "attributes": { "name": "Beta LLC" }, "measures": { "arr": 50000 } },
        "sourceRefs": [{ "system": "test", "id": "T003" }]
      }
    ]
  }'
```

#### MCP Server (port 3001)

```bash
# Health check
curl http://localhost:3001/health

# Initialize an MCP session
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "curl-test", "version": "1.0" }
    }
  }'

# List available tools (use the mcp-session-id from the initialize response header)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'

# Call get_entity
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_entity",
      "arguments": { "type": "customer", "name": "Test Corp" }
    }
  }'

# Call search_entities
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "search_entities",
      "arguments": { "type": "customer", "limit": 5 }
    }
  }'

# Call record_transaction via MCP
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "record_transaction",
      "arguments": {
        "objectId": "<objectId>",
        "transactionType": "health_score_updated",
        "context": { "previous": 72, "current": 65, "reason": "Support cases increasing" }
      }
    }
  }'
```

---

## 📁 Project Structure

```
acp/
├── packages/
│   ├── core/                       # Shared: models, DB, engine (deep-merge, diff, snapshot)
│   ├── api/                        # REST API (10 handlers + local-server.ts for Docker)
│   ├── mcp-server/                 # MCP Server (Streamable HTTP, 5 tools)
│   └── cli/                        # CLI (`acp` command, pure HTTP client)
│       ├── standard-templates/     # 10 YAML templates
│       └── src/
│           ├── commands/           # init, ctx-*, txn-*, changes, connect-*
│           ├── connectors/         # CSV/JSON/JSONL extractor
│           └── pipelines/          # YAML parser, mapper, auto-mapper
├── skills/                         # 5 pre-built agent skills
├── infra/                          # AWS CDK
├── docker-compose.yml              # Postgres + API + MCP
├── Dockerfile.api
└── Dockerfile.mcp
```

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict) |
| Runtime | Node.js 20.x |
| Monorepo | pnpm workspaces |
| Database | PostgreSQL 16 + pgvector + pg_trgm |
| DB Client | pg (no ORM) |
| MCP SDK | @modelcontextprotocol/sdk |
| CLI | commander + inquirer + chalk |
| IaC | AWS CDK |
| Testing | vitest |

---

## 🔄 Schema Evolution

ACP stores context as JSONB, not as database columns. There is no `ALTER TABLE ADD COLUMN` when you add a field. The database doesn't know or care about your schema. This makes schema changes almost free.

### Add a New Field to an Existing Dimension

Update your template YAML, update your pipeline mapping, run `acp connect sync`. New records get the field. Old records don't — they still work, the field is just absent.

```
Old customer:  context.measures = { arr: 480000, health_score: 34 }
New customer:  context.measures = { arr: 480000, health_score: 34, churn_probability: 0.72 }
```

No migration. No downtime. The deep merge adds the new field on the next sync without overwriting existing data. Agents treat missing fields as "not available" rather than zero or false.

### Add a New Dimension

The 7-dimension schema (attributes, measures, actors, temporals, locations, intents, processes) is a convention, not a database constraint. You can add an 8th dimension by putting it in your template and pipeline:

```yaml
# contexts/customer.yaml — add a "compliance" dimension
compliance:
  gdpr_status: { type: string }
  data_residency: { type: string }
  last_audit: { type: date }
```

```yaml
# pipelines/hubspot.yaml — map source fields to it
mapping:
  compliance:
    gdpr_status: company.gdpr_flag
    last_audit: company.last_compliance_audit
```

Run `acp connect sync`. New records get the compliance dimension. Old records keep their 7 dimensions. Both coexist in the same database. No migration needed.

### Rename or Restructure a Field

This is the one case that needs care. If you rename `health_score` to `health_index`, old data has the old key and new data has the new key. Two approaches:

**Gradual migration:** map both fields during transition, update skills and prompts to use the new name, eventually drop the old mapping.

**Backfill script:** update all existing records in one SQL statement:

```sql
UPDATE context_objects 
SET context = jsonb_set(
  context, 
  '{measures,health_index}', 
  context->'measures'->'health_score'
)
WHERE context->'measures'->'health_score' IS NOT NULL;
```

### Why This Works

The deep merge on upsert is the key:

```
Existing: { measures: { arr: 480000, health_score: 34 } }
Update:   { measures: { churn_probability: 0.72 } }
Result:   { measures: { arr: 480000, health_score: 34, churn_probability: 0.72 } }
```

Old fields preserved. New fields added. No data lost. Old and new records coexist. Agents handle missing fields gracefully. Templates and pipelines evolve independently of the database.

---

Built by [Kartha AI](https://kartha.ai)