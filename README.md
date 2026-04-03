# Agent Context Platform (ACP)

**Give your AI agents a unified view of your business data.**

Instead of wiring up individual MCP servers to Salesforce, HubSpot, Stripe, and every other system — extract your data once, curate it into a canonical schema, and serve it through a single MCP server. Any agent framework connects to ACP and gets everything it needs in one call.

```
Your data (CRM, billing, support, ERP)
  → ACP curates into 7-dimension context profiles
  → Agents query via MCP: "What's happening with Acme Corp?"
  → One call returns everything, organized by dimension:
      measures:  ARR $480K, health score 34, NPS 28
      temporals: renewal in 45 days, last QBR 3 months ago
      actors:    owner Sarah Chen, contact Jane Lee
      intents:   churn risk HIGH, expansion potential LOW
      processes: onboarding complete, support tier premium
```

ACP is open source, runs locally via Docker Compose, and deploys to AWS/GCP for team use.

[View interactive architecture diagram](https://htmlpreview.github.io/?https://github.com/Kartha-AI/agent-context-platform/blob/main/acp-architecture.html)

![ACP Overview](acp-overview.png)

---

## Why ACP?

Every AI agent framework — CrewAI, LangGraph, AutoGen, Mastra, Claude, GPT — has the same unsolved problem: **where does the agent get good business context?**

| Current approach | Problem |
|-----------------|---------|
| Individual MCP servers per system | Fragmented context, no cross-system reasoning |
| Vector databases | Unstructured dumps, no canonical schema |
| Raw API calls from agents | Inconsistent, slow, no pre-joined context |
| CDPs (Segment, RudderStack) | Customer-only, marketing-focused |

ACP solves this the way Snowflake solved analytics: extract → curate → serve. Except instead of SQL for analysts, ACP serves MCP tools for agents.

**What makes ACP different:** every entity is organized into 7 semantic dimensions (what, how much, who, when, where, why, how). Agents don't get a flat bag of fields — they get structured context they can navigate. An agent assessing risk knows to check `measures` for health scores and `temporals` for upcoming deadlines. See [Context Object Model](#context-object-model) for details.

---

## ACP vs the Alternatives

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

### Without ACP: Vector database

```
All documents embedded into Pinecone/Weaviate.

User: "Which customers have ARR over $200K and are at risk?"

Agent gets 10 text chunks: "Acme renewed in 2024..." "ticket #4521 escalated..."
Can't filter by ARR > $200K — it's embedded text, not a queryable number.
No current state. No structured fields. No changefeed.
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

### Cross-entity reasoning

This is where ACP shines. All entity types are in the same store, with the same dimensional structure:

```
"Which customers with ARR > $200K have overdue invoices AND open support cases?"

Without ACP: agent queries 3 systems, fuzzy-matches company names, correlates
             in its reasoning (error-prone, slow, token-expensive).

With ACP: all entities share the same namespace.
  1. search_entities({ type: "customer", filters: { "measures.arr": { "gt": 200000 } } })
  2. search_entities({ type: "invoice", filters: { "attributes.status": { "eq": "overdue" } } })
  3. Cross-reference by customer name — consistent format, reliable match.

Or pre-join in the pipeline: customer profile includes overdue_invoice_count.
Agent makes ONE call.
```

---

## What Standardization Gives You

### Agent portability

An agent built on ACP works with any data source. Switch from HubSpot to Salesforce? Change the pipeline YAML. The agent code doesn't change — it still reads `measures.arr` and `intents.churn_risk`. Without ACP, switching CRMs means rewriting every agent integration.

### Template reuse

Company A builds a customer risk assessment agent on ACP. Company B uses the same agent — same context type, same dimensions. The only difference is the pipeline YAML that maps their CRM fields to the canonical schema. The agent is portable across organizations.

### Proactive agents via changefeed

Without ACP, agents only respond when asked. With ACP, agents poll `get_context_changes` on a schedule and act on changes autonomously. Health score drops from 87 to 34 → agent auto-creates a risk assessment. Invoice overdue for 30 days → agent sends an alert. This requires a unified change tracking layer that individual MCP servers don't provide.

### Agent-to-agent coordination

Multiple agents read and write to the same context store. They coordinate through data, not direct messaging:

```
Agent A: monitors customer health → writes risk_assessed transaction
Agent B: polls changefeed → sees risk_assessed → creates escalation
Agent C: polls changefeed → sees escalation → notifies account owner
```

Each agent is independent. They don't know about each other. They coordinate by writing and reading context — the same pattern that makes microservices work with event-driven architecture.

### Cross-org context sharing (future)

The long-term play: Company A (vendor) shares context with Company B (customer). Both run ACP. Company A's agent can see its vendor profile enriched with Company B's customer context. Cross-organization reasoning without point-to-point API integrations. This is the network effect — the same moat that data sharing built for Snowflake.

---

## How It Works

**The platform** runs as Docker containers (Postgres + REST API + MCP server). It's schema-agnostic — it stores any JSONB context, deep merges it, tracks changes, and serves it to agents.

**Your project** is a separate directory with your context type definitions, field mappings, and data files. The CLI reads your project files, validates your data, and loads it into the running platform.

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

**Two ways to use it** — ad-hoc questions and structured skills:

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

Both work with the same MCP tools and the same data. Skills are optional — they add structure for recurring business processes, but you get full value from day one just by asking questions.

---

## Quick Start

### Prerequisites

- **Node.js** 20.x
- **pnpm** (`npm install -g pnpm`)
- **Docker** (for Postgres, API, and MCP server)

### 1. Start the Platform

```bash
git clone https://github.com/Kartha-AI/agent-context-platform
cd agent-context-platform

pnpm install
pnpm run build

docker compose up -d

# Verify — all 3 services should be healthy
docker compose ps
curl http://localhost:3002/v1/health
```

### 2. Install the CLI

```bash
pnpm setup                 # creates global bin dir (if needed)
source ~/.zshrc            # reload shell
cd packages/cli && pnpm link --global
```

`acp` is now available globally from any directory.

### 3. Try the Demo (2 minutes)

```bash
# Create a demo project with sample data
acp init --demo ~/projects/acp-demo
cd ~/projects/acp-demo

# Load demo data (20 customers, 40 contacts, 50 invoices, 10 vendors)
acp connect sync

# Query your data
acp ctx list
acp ctx get customer "Meridian Technologies"
acp ctx search --type customer --filter '{"context.measures.health_score":{"lt":50}}'
acp txn list --types risk_assessed
acp changes --since 2026-03-01T00:00:00Z
```

### 4. Connect Claude Desktop

Add to your `claude_desktop_config.json`:

**HTTP mode** (platform running via Docker):
```json
{ "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
```

**stdio mode** (direct process):
```json
{
  "mcpServers": {
    "acp": {
      "command": "node",
      "args": ["<repo-path>/packages/mcp-server/dist/index.js"],
      "env": {
        "ACP_MCP_TRANSPORT": "stdio",
        "DATABASE_URL": "postgresql://acp:localdev@localhost:5432/acp"
      }
    }
  }
}
```

Now ask Claude:

> "Which customers have health scores below 50? What happened recently with each of them?"

> "Show me all overdue invoices over $10,000 and which customers they belong to."

> "What vendors have contracts expiring in the next 90 days?"

Claude calls ACP's MCP tools, gets the context, and reasons across all your business data.

### 5. Load Your Own Data

```bash
acp init ~/projects/my-ops       # pick context types interactively
cd ~/projects/my-ops
cp ~/downloads/customers.csv data/
acp connect add csv              # generates pipeline YAML with auto-mapping
# review pipelines/customers-csv.yaml — adjust mappings if needed
acp connect sync                 # validates + loads data
acp ctx list                     # see what's loaded
```

---

## Deployment Options

ACP runs anywhere Docker runs. The same code, same data, same CLI — only the infrastructure changes.

### Local (development)

```bash
docker compose up -d
# Platform running at localhost:3002 (API) and localhost:3001 (MCP)
```

### Server (always-on agent)

Same Docker Compose on any Linux server. Your agent runs 24/7, polls the changefeed, acts on changes.

```bash
ssh myserver
git clone https://github.com/Kartha-AI/agent-context-platform
cd agent-context-platform && docker compose up -d

# Set up a cron job to sync data hourly
0 * * * * cd /path/to/my-project && acp connect sync
```

### AWS/GCP (team deployment)

Deploy the platform into your own cloud account via CDK. Multiple developers and agents share the same context store.

```bash
export ACP_ENV=prod
cd infra && pnpm run deploy
```

This deploys three stacks:
1. **acp-{env}-data** — VPC, RDS PostgreSQL, Secrets Manager
2. **acp-{env}-api** — API Gateway + Lambda functions
3. **acp-{env}-mcp** — ECS Fargate + ALB + ECR

Your CLI projects just point at the cloud endpoint:

```yaml
# acp.yaml
platform:
  api_url: https://acp-api.your-company.com
  api_key: ${ACP_API_KEY}
```

### Kartha Cloud (coming soon)

Managed hosting with team access, audit logs, and SLA guarantees. [Sign up for early access at kartha.ai](https://kartha.ai)

---

## Pre-Built Skills

Skills are pre-built agent workflows that run on top of ACP data. ACP provides the data and the MCP tools. Skills provide the business logic — what to check, how to assess, what to record.

**Skills are NOT code that ACP executes.** They are instructions your agent follows. Your agent runtime (Claude Desktop, CrewAI, LangGraph, or any MCP client) runs the skill. ACP just provides the data.

### What Ships

Five skills ship in the `skills/` directory, mapped to [APQC Process Classification Framework](https://www.apqc.org/process-frameworks) categories:

| Skill | APQC Process | Context Types | What It Does |
|-------|-------------|---------------|--------------|
| **Customer Health Monitor** | 3.3.4 Manage Customer Health | customer, case | Polls changefeed, classifies risk (critical/high/medium/low), records `risk_assessed` transactions |
| **Pipeline Risk Assessment** | 3.2.5 Manage Sales Pipeline | opportunity, customer | Flags stale deals, missing context, overvalued pipeline, records `deal_risk_assessed` |
| **Invoice Collections Tracker** | 8.3.4 Manage Collections | invoice, customer | Finds overdue invoices, groups by aging bracket, cross-references customer health |
| **Case Escalation Monitor** | 5.2.3 Manage Escalations | case, customer | Context-aware escalation using ARR, health score, renewal date — not just priority rules |
| **Vendor Performance Review** | 11.1.3 Assess Vendor Performance | vendor, invoice, contract | Scores vendors on delivery/quality/commercial/relationship, flags contract renewals |

### How Skills Work

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

### Using a Skill with Claude Desktop

1. Connect ACP MCP server (see [Quick Start](#4-connect-claude-desktop))
2. Create a new Project in Claude Desktop
3. Open `skills/customer-health-monitor/examples/claude-project.md`
4. Paste the contents into the Project's system prompt
5. Ask: "Check customer health" or "Run the health monitor"

Claude follows the skill prompt, calls the MCP tools, assesses each customer, and writes risk assessments back to ACP.

### Using a Skill with CrewAI

```python
from crewai import Agent, Task, Crew
from pathlib import Path

skill_prompt = Path("skills/customer-health-monitor/prompt.md").read_text()

health_monitor = Agent(
    role="Customer Health Monitor",
    goal="Detect at-risk customers and record assessments in ACP",
    backstory=skill_prompt,
    tools=[acp_mcp_tools],
)

crew = Crew(agents=[health_monitor], tasks=[Task(
    description="Check for health changes in the last 6 hours",
    agent=health_monitor
)])
crew.kickoff()
```

### Skills vs Ad-Hoc Questions

You don't need skills to use ACP. Any agent connected via MCP can ask any question about your data:

```
Ad-hoc:  "What's Acme Corp's ARR?"              → agent calls get_entity, answers
Ad-hoc:  "Which invoices are overdue?"           → agent calls search_entities, answers
Ad-hoc:  "Compare our top 5 vendors"             → agent calls search_entities, reasons, answers

Skill:   "Run the health monitor"                → follows defined workflow, records transactions
Skill:   "Run the monthly vendor review"         → scores each vendor, writes vendor_review transactions
```

Ad-hoc questions are great for exploration. Skills add consistency, auditability, and agent-to-agent coordination — one skill's output becomes another skill's input via the changefeed.

### Getting Skills with `acp init`

When you create a project, the CLI offers skills that match your selected context types:

```bash
acp init ~/projects/my-ops

  Context types:
    [x] customer
    [x] invoice
    [x] case

  Skills for your context types:
    [x] Customer Health Monitor     (uses: customer, case)
    [x] Invoice Collections Tracker (uses: invoice, customer)
    [x] Case Escalation Monitor     (uses: case, customer)
    [ ] Pipeline Risk Assessment    (needs: opportunity — not selected)
    [ ] Vendor Performance Review   (needs: vendor — not selected)
```

Selected skills are copied to your project's `skills/` directory where you can customize them.

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

These mirror the MCP tools — same data, terminal interface.

| Command | MCP Equivalent | Purpose |
|---------|---------------|---------|
| `acp ctx list` | — | Entity counts by type |
| `acp ctx get <type> <name\|id>` | `get_entity` | Full entity profile with recent transactions |
| `acp ctx search --type --query --filter --limit` | `search_entities` | Search entities |
| `acp txn list --object-id --types --since --until` | `get_transactions` | List transactions |
| `acp txn add --object-id --type --context` | `record_transaction` | Record a transaction |
| `acp changes --since --types --limit` | `get_context_changes` | Changefeed |

### Query Examples

```bash
# Entity counts
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
pnpm run test                  # all tests
pnpm run test:unit             # fast, no DB
pnpm run test:integration      # needs Postgres
pnpm run test:e2e              # full pipeline
```

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

**Streamable HTTP (default)** — for remote agents and Claude.ai:
```json
{ "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
```

**stdio** — for Claude Desktop local:
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

## Architecture

[View interactive architecture diagram](https://htmlpreview.github.io/?https://github.com/Kartha-AI/agent-context-platform/blob/main/acp-architecture.html)

### Design Principles

- **Platform is schema-agnostic.** It stores and serves JSONB context objects without opinion on schema. Templates and validation live in the CLI.
- **API and MCP both use `@acp/core` directly.** Same repositories, same engine, same DB connection pool. No HTTP hop between them.
- **CLI is a pure HTTP client.** It talks to the REST API. No `@acp/core` dependency. Works against local or remote deployments.

### How the Pieces Fit

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

**Write Path 1 — Pipelines write entity context via CLI or REST API:**

```
Source data (CSV, JSON, databases)
  → acp connect sync (CLI validates against templates, maps fields)
  → POST /v1/objects/bulk (REST API)
  → Platform deep merges, diffs, writes change_log
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
```

**Read Path 2 — Polling agent checks for changes:**

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

### 7-Dimension Schema — Why It Matters for Agents

Most data platforms give agents a flat bag of fields. The agent has to figure out: which fields are dates? Which are numbers? Which tell me about risk? Which tell me who to contact?

ACP organizes every entity's context into 7 semantic dimensions. Agents don't parse — they navigate:

```json
{
  "attributes": {},   // WHAT  — core identity facts (name, industry, status)
  "measures": {},     // HOW MUCH — numbers the agent can reason about (ARR, health score, NPS)
  "actors": {},       // WHO — people to contact, owners, stakeholders
  "temporals": {},    // WHEN — dates that drive urgency (renewal, last activity, SLA deadline)
  "locations": {},    // WHERE — geography, territory, timezone
  "intents": {},      // WHY — strategy, risk signals, churn indicators
  "processes": {}     // HOW — current stage, workflow state, next steps
}
```

**This structure makes agents faster and more accurate.** An agent assessing customer risk knows exactly where to look:

| Agent task | Dimensions used | What the agent finds |
|-----------|----------------|---------------------|
| "Is this customer at risk?" | measures + intents + temporals | health_score: 34, churn_risk: high, renewal_date: 45 days away |
| "Who should I contact?" | actors + attributes | primary_contact: Jane Lee, role: VP Engineering, owner: Sarah Chen |
| "What happened recently?" | Recent transactions | risk_assessed 2 days ago, case_opened last week, NPS dropped |
| "What's the financial picture?" | measures | ARR: $480K, MRR: $40K, lifetime_value: $1.2M, open_cases: 3 |
| "How urgent is this?" | temporals + processes | renewal in 45 days, onboarding: completed, SLA: at_risk |

Without this structure, every agent prompt needs to say "look at field X, Y, Z and interpret them as dates/numbers/risk signals." With ACP, the schema does that work once — every agent benefits.

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

Templates are YAML files that define fields, types, descriptions, and allowed transaction types. `acp init` copies selected templates into your project's `contexts/` directory where you can customize them.

### Database Schema

Three tables back the platform:

- **context_objects** — Entity profiles with JSONB context, trigram name index, GIN JSONB index, pgvector embedding column, composite unique index on source reference
- **context_transactions** — Activity history linked to entities, indexed by object + time and by type + time
- **change_log** — Powers the changefeed polling pattern, indexed by changed_at for cursor-based pagination

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
| `GET` | `/v1/objects/changes` | Changefeed — what changed since timestamp |
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
│   │       └── engine/             # deep-merge, diff, snapshot
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
├── infra/                          # AWS/GCP CDK (DataStack, ApiStack, McpStack)
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
| API | Lambda handlers + local HTTP server |
| IaC | AWS CDK (TypeScript) |
| Testing | vitest |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Key rules:
- All existing tests must pass on every PR
- New templates: just add a YAML file — test loop covers it automatically
- New connectors: include extractor tests + e2e sync test
- Core engine changes (deep-merge, diff): require extra review

---

## License

[MIT](LICENSE)

---

Built by [Kartha AI](https://kartha.ai) — कर्ता: Sanskrit for "the one who acts"