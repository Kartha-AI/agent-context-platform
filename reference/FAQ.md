# ❓ Frequently Asked Questions

---

## Why ACP?

### Can't I just upload a spreadsheet to Claude or ChatGPT and ask questions?

Yes — and for a one-off question about one spreadsheet, you should. That's faster.

ACP is for when that stops being enough:

| Upload to Claude/ChatGPT | Kartha ACP |
|--------------------------|------------|
| One file at a time | All data, all systems, unified |
| One conversation, then gone | Persistent — data survives sessions |
| One person | Shared — team + multiple agents |
| Upload again every time | Sync once, query anytime |
| No cross-file relationships | Pre-joined across systems |
| No change tracking | Changefeed — what changed since when |
| No memory between sessions | Transactions accumulate over time |
| Context window limits (~100K rows) | Database — no size limit |
| Only runs when you ask | Agents poll and act 24/7 |

If you have one spreadsheet and one question, upload it to Claude. If you have data from multiple systems, need persistent context, want proactive agents, or need a team sharing the same intelligence — that's ACP.

### Why not just connect multiple MCP servers directly (HubSpot MCP + Stripe MCP + Zendesk MCP)?

That works for simple, single-system questions. It breaks when:

- **Cross-system identity**: HubSpot says "Acme Corp", Stripe says "Acme Corporation", Zendesk says "ACME". The agent guesses if they're the same. ACP resolves identity at pipeline time — once.
- **Token cost**: 3 API calls = 5,300+ tokens of raw data. ACP returns 800 tokens of pre-joined context. 85% fewer tokens, faster answers.
- **No pre-joined context**: The agent has to correlate data across systems in its reasoning. Burns tokens on JOINing, not on answering your question.
- **No change tracking**: Direct connectors return current state on demand. ACP tracks what changed — agents can poll and act on changes.
- **No memory**: Each conversation starts from scratch. ACP accumulates agent decisions as transactions.

See [ACP vs Direct Connectors](kartha-acp-vs-direct-connectors.md) for the full comparison.

### Why not use a vector database (Pinecone, Weaviate)?

Vector databases store unstructured text chunks. You can't filter by `ARR > $200K` or query by `renewal_date < 2026-06-01`. ACP stores structured, typed, queryable context with JSONB operators, trigram search, AND optional vector similarity — all in one database.

### How is this different from Salesforce Agentforce or OpenAI Frontier?

Those are closed, vendor-locked enterprise platforms. ACP is open source and framework-agnostic:

| | ACP | OpenAI Frontier | Salesforce Agentforce |
|---|---|---|---|
| Open source | Yes | No | No |
| Self-hosted | Yes | No | No |
| Any LLM/agent | Yes | OpenAI only | Salesforce only |
| Getting started | `docker compose up` | Contact sales | Salesforce license |
| Pricing | Free | Enterprise | Per-conversation |

### What does ACP stand for?

Agent Context Platform. It's the context warehouse for AI agents — extract, curate, serve.

### What does Kartha mean?

कर्ता (Kartha) is Sanskrit for "the one who acts" — the agent that takes action with the right context.

---

## Getting Started

### What do I need to run ACP?

Three things: Node.js 20+, pnpm, and Docker. See the [Quick Start](README.md#-quick-start) for install instructions.

### How long does the initial setup take?

About 10 minutes from `git clone` to asking your first question via Claude Desktop. The demo project loads in under 30 seconds.

### Do I need to know TypeScript to use ACP?

No. You interact with ACP through the CLI (`acp` commands), YAML files (templates and pipelines), and your agent (Claude Desktop, CrewAI, etc.). TypeScript is only needed if you want to contribute to the platform code itself.

### Can I try it without loading my own data?

Yes. Run `acp init --demo` to create a project with sample data — 20 customers, 40 contacts, 50 invoices, 10 vendors. Connect Claude Desktop and start asking questions immediately.

### What agents work with ACP?

Any MCP-compatible agent or framework: Claude Desktop, Cursor, CrewAI, LangGraph, AutoGen, Mastra, or any custom agent that speaks MCP. ACP also has a CLI for terminal-based access.

---

## Data & Connectors

### What data formats does ACP accept?

Currently: CSV, JSON, and JSONL files. Excel (.xlsx) support is coming soon. You can export CSV from virtually any business tool — HubSpot, Stripe, Salesforce, QuickBooks, spreadsheets, databases.

### Does ACP connect directly to HubSpot, Salesforce, or Stripe APIs?

Not yet. V1 uses file-based connectors (CSV/JSON). API connectors for popular systems are on the roadmap. For now, export a CSV from your source system, map it with `acp connect add csv`, and sync.

### How do I map my data to ACP's schema?

The CLI auto-generates a pipeline YAML when you run `acp connect add csv`. It reads your CSV headers, matches them to template fields, and creates a draft mapping. You review and adjust. Typically 70-80% of fields are mapped correctly on the first pass.

### Can I load data from multiple systems into the same entity?

Yes — this is ACP's core value. Create a pipeline YAML for each source (e.g., HubSpot CSV, Stripe CSV, Zendesk CSV) all targeting the same context type (e.g., `customer`). When you run `acp connect sync`, ACP deep-merges the data into one unified entity, matched by name. One customer profile with data from all three systems.

### What happens when I re-sync with updated data?

ACP deep-merges new data into existing entities. Fields in the update overwrite. Fields NOT in the update are preserved. Every change is logged with the previous and current value. Agents can poll the changefeed to see what changed.

### Is my data safe? Where is it stored?

Data is stored in your Postgres database — either locally in a Docker volume or in your own cloud (RDS, Cloud SQL). ACP never sends your data to any external service. It's your database, your infrastructure, your data.

### Can I load sensitive data?

Yes, but don't commit sensitive CSV files to git. Add `data/*.csv` to your `.gitignore`. The data lives in Postgres, not in the repo.

### How much data can ACP handle?

Postgres with JSONB handles tens of thousands of entities easily on a single instance. For a typical deployment (1,000-10,000 entities, a few hundred queries per day), a $20/month VPS or RDS instance is more than enough. See [Schema Evolution](README.md#-schema-evolution) for scaling guidance.

---

## Context Types & Schema

### What are the 7 dimensions?

Every entity's context is organized into 7 semantic dimensions that help agents navigate:

| Dimension | Question | Example |
|-----------|----------|---------|
| attributes | WHAT | name, industry, status, segment |
| measures | HOW MUCH | ARR, health score, NPS, open cases |
| actors | WHO | owner, contact, champion |
| temporals | WHEN | renewal date, last activity, SLA deadline |
| locations | WHERE | region, territory, timezone |
| intents | WHY | churn risk, competitors, expansion potential |
| processes | HOW | pipeline stage, onboarding status, SLA status |

### Can I add my own context types?

Yes. Run `acp ctx define <name>` to create a custom context type interactively. Define fields across the 7 dimensions. A YAML template is generated in your project's `contexts/` directory.

### Can I add fields to an existing context type?

Yes. Edit the template YAML in `contexts/`, update your pipeline YAML to map the new field, run `acp connect sync`. Old entities keep their existing fields; new/updated entities get the new field. No database migration needed — JSONB is schema-flexible.

### Can I add an 8th dimension?

Yes. The 7 dimensions are a convention, not a database constraint. Add any key to your context YAML and pipeline mapping. The platform stores whatever JSONB you send it.

### What standard context types ship with ACP?

Ten types covering common business entities:

| Type | Category | Use case |
|------|----------|----------|
| customer | CRM | Customer/account profiles |
| contact | CRM | People at customer organizations |
| opportunity | CRM | Sales deals and pipeline |
| case | CRM | Support tickets and issues |
| vendor | CRM | Supplier/vendor profiles |
| invoice | Finance | Billing and accounts receivable |
| contract | Legal | Agreements and terms |
| shipment | Logistics | Deliveries and fulfillment |
| product | Commerce | Products and catalog items |
| employee | HR | Team members and roles |

---

## Skills

### What are skills?

Skills are pre-built agent workflows — prompt templates that tell your agent what to check, how to assess, and what to record. They're not code ACP executes. Your agent runtime (Claude Desktop, CrewAI, etc.) runs the skill. ACP provides the data.

### Do I need skills to use ACP?

No. Skills are optional. Any agent connected via MCP can ask ad-hoc questions about your data without any skill loaded. Skills add structure for recurring business processes — repeatable, consistent, with results recorded.

### What skills ship with ACP?

Five skills mapped to APQC business process categories:

| Skill | What it does |
|-------|-------------|
| Customer Health Monitor | Polls for health changes, classifies risk, records assessments |
| Pipeline Risk Assessment | Flags stale deals, missing context, overvalued pipeline |
| Invoice Collections Tracker | Groups overdue invoices by aging, cross-references customer health |
| Case Escalation Monitor | Context-aware escalation using ARR, health, renewal date |
| Vendor Performance Review | Scores vendors across 4 dimensions, flags contract renewals |

### How do I use a skill with Claude Desktop?

1. Connect ACP MCP server (see Quick Start)
2. Create a new Project in Claude Desktop
3. Paste the skill's `examples/claude-project.md` into the Project system prompt
4. Ask: "Run the health monitor" or "Check customer health"

### Can I write my own skill?

Yes. A skill is just a directory with a prompt, a YAML metadata file, and examples. Copy an existing skill, modify the prompt and Key Fields, and you have a new skill. No code changes to ACP needed.

### Can I use skills with agents other than Claude Desktop?

Yes. Each skill includes a `prompt.md` (framework-agnostic) and example implementations for Claude Desktop and CrewAI. The prompt works with any agent that can call MCP tools.

---

## Deployment

### Can I run ACP on my laptop?

Yes. `docker compose up -d` starts everything locally — Postgres, REST API, MCP server. This is the default development setup.

### How do I keep ACP running when my laptop is off?

Deploy the same Docker Compose to any Linux server (VPS, DigitalOcean, Hetzner — $10-20/month). Same commands, just on a server. Add a cron job for periodic data sync.

### How do I deploy for my team?

Deploy to AWS (RDS + ECS Fargate) or GCP (Cloud SQL + Cloud Run). CDK stacks are provided. Your team's CLI projects point at the shared API endpoint via `acp.yaml`. Multiple agents connect to the shared MCP server.

### Can different team members see the same data?

Yes. When multiple people and agents connect to the same ACP deployment, they all query the same context store. One person loads data, everyone benefits.

### Can I run multiple ACP instances?

Yes. Each Docker Compose deployment is independent. A sales team and a finance team can each run their own platform, or share one.

### Is there a managed cloud version?

Kartha Cloud (managed hosting with team access, audit logs, and SLA) is coming soon. For now, self-hosted via Docker Compose or your own cloud is the way to go.

---

## Architecture & Internals

### What database does ACP use?

PostgreSQL 16 with pgvector (vector similarity search) and pg_trgm (fuzzy text matching). Postgres was chosen because ACP needs both structured queries (JOINs, filters, aggregations) and flexible schema (JSONB) in one database.

### Why Postgres instead of MongoDB or DynamoDB?

ACP needs atomic transactions across tables (upsert entity + write change log), JSONB path filtering, fuzzy text search, and optional vector search — all in one engine. MongoDB can't do atomic multi-collection writes reliably. DynamoDB can't do ad-hoc JSONB queries. Postgres does all of this with one connection pool and one deployment.

### What's the difference between the REST API and MCP server?

Both access the same data through the same `@acp/core` library. REST API is for pipelines and integrations (the CLI talks to it). MCP server is for agents (Claude Desktop, CrewAI talk to it). Same database, same engine, different interface.

### What's the changefeed?

The `change_log` table tracks every change to every entity — what field changed, the previous and current values, and a context snapshot. Agents poll it using `get_context_changes({ since: timestamp })` to discover what changed and act on it. This is how proactive agents work — they don't wait to be asked.

### What's deep merge?

When you sync data, ACP doesn't replace the entire entity. It deep-merges the new data into the existing context:
- New fields are added
- Existing fields in the update are overwritten
- Existing fields NOT in the update are preserved
- Arrays are replaced, not appended
- `null` values delete fields

This means you can sync from multiple sources (HubSpot + Stripe + Zendesk) into the same entity, and each source's fields coexist without overwriting each other.

---

## Extending ACP

### Can I use ACP for non-business data?

Yes. The 7-dimension schema works for any domain. Define custom context types for fleet vehicles, patient records, real estate properties, manufacturing runs, legal matters — anything with structured attributes. The platform is schema-agnostic.

### Can I add new connectors?

Yes. A connector is a module that reads data from a source and outputs rows for the mapper. CSV/JSON/JSONL are built in. Adding a new connector (e.g., Excel, Postgres direct query, API) means writing an extractor that reads the source and returns rows in the same format. See CONTRIBUTING.md for guidelines.

### Can I contribute skills?

Yes. Skills are the easiest contribution — a YAML file, a prompt, and a README. No platform code changes needed. See the existing skills in `skills/` for the pattern.

### Can I use ACP with a different database?

ACP is built for Postgres and uses Postgres-specific features (JSONB operators, GIN indexes, pgvector, pg_trgm). Swapping databases would require significant changes to the repository layer. Postgres is recommended.

---

## Troubleshooting

### `docker compose up` fails

- Make sure Docker is running (`docker ps` should work)
- Check port conflicts: Postgres needs 5432, API needs 3002, MCP needs 3001
- Try `docker compose down -v && docker compose up -d` for a clean start

### `acp` command not found

- Run `cd packages/cli && pnpm link --global`
- Reload your shell: `source ~/.zshrc` or `source ~/.bashrc`
- Verify with `which acp`

### `acp connect sync` fails with connection error

- Make sure the platform is running: `docker compose ps`
- Check the API health: `curl http://localhost:3002/v1/health`
- Verify `acp.yaml` points to the right URL (default: `http://localhost:3002`)

### Claude Desktop doesn't see ACP tools

- Check your `claude_desktop_config.json` has the correct MCP config
- Make sure the `{path-to-acp}` is the absolute path to your cloned repo
- Restart Claude Desktop after changing the config
- Check that `packages/mcp-server/dist/index.js` exists (run `pnpm run build` if not)

### Data loaded but agent gives generic answers

- Verify data loaded: `acp ctx list` should show entity counts
- Verify entity content: `acp ctx get customer "your entity name"`
- If the agent doesn't reference specific data, check that Claude Desktop restarted after config change
- Try asking a specific question: "What is the ARR for [entity name]?" to test tool usage

### Pipeline YAML mapping looks wrong

- Edit `pipelines/<name>.yaml` manually — it's just a YAML file
- Re-run `acp connect sync` after edits
- The auto-mapper is a starting point, not a final answer — review every mapping before syncing production data

---

## Pricing & Licensing

### Is ACP free?

Yes. ACP is open source under the MIT license. Free to use, modify, and deploy.

### Will there be a paid version?

Kartha Cloud (managed hosting) is planned with team features, audit logs, and SLA guarantees. The open source platform will always be free.

### Can I use ACP commercially?

Yes. MIT license allows commercial use without restrictions.
