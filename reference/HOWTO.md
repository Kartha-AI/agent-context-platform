# How-To Guide — Kartha ACP

Step-by-step guides for common scenarios. Each one starts from scratch and ends with an agent querying your data.

**Prerequisites for all scenarios:**
- ACP platform running (`docker compose up -d`)
- CLI installed (`cd packages/cli && pnpm link --global`)
- An MCP-compatible agent (Claude Desktop, Cursor, CrewAI, etc.)

---

## Scenario 1: Try the Demo (5 minutes)

Best for: First-time users who want to see ACP in action before loading their own data.

### Steps

```bash
# Create a demo project with sample data
acp init --demo ~/projects/acp-demo
cd ~/projects/acp-demo

# Load the demo data
acp connect sync
# → Synced 20 customers, 40 contacts, 50 invoices, 10 vendors

# Explore what was loaded
acp ctx list
# → customer: 20 entities
# → contact:  40 entities
# → invoice:  50 entities
# → vendor:   10 entities

# Look at a specific entity
acp ctx get customer "Meridian Technologies"

# Search with filters
acp ctx search --type customer --filter '{"context.measures.health_score":{"lt":50}}'
```

### Connect an Agent

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{ "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
```

Ask Claude:

- "Which customers have health scores below 50?"
- "Show me all overdue invoices and which customers they belong to"
- "Compare our top 5 vendors by on-time delivery rate"

### What the Demo Creates

```
acp-demo/
├── acp.yaml
├── contexts/
│   ├── customer.yaml         # 20 sample companies with full 7-dimension profiles
│   ├── contact.yaml          # 40 contacts linked to customers
│   ├── invoice.yaml          # 50 invoices (some overdue) linked to customers
│   └── vendor.yaml           # 10 vendors with performance metrics
├── pipelines/
│   ├── demo-customers.yaml
│   ├── demo-contacts.yaml
│   ├── demo-invoices.yaml
│   └── demo-vendors.yaml
├── data/
│   ├── customers.csv
│   ├── contacts.csv
│   ├── invoices.csv
│   └── vendors.csv
└── skills/
    ├── customer-health-monitor/
    ├── invoice-collections-tracker/
    └── vendor-performance-review/
```

---

## Scenario 2: Standard Template with Your Own CSV (10 minutes)

Best for: Developers who have business data exported as CSV from HubSpot, Stripe, Salesforce, or any system.

### Steps

```bash
# Create a project and pick standard templates
acp init ~/projects/my-ops
cd ~/projects/my-ops

# Interactive prompts:
#   Which context types do you need?
#     [x] customer
#     [x] invoice
#     [ ] contact
#     [ ] opportunity
#     ...
#
#   Which skills? (based on selected types)
#     [x] Customer Health Monitor
#     [x] Invoice Collections Tracker
#     [ ] Pipeline Risk Assessment (needs: opportunity)
#     ...
```

### Add Your Data

```bash
# Copy your CSV exports into the data directory
cp ~/downloads/hubspot-companies.csv data/
cp ~/downloads/stripe-invoices.csv data/
```

### Generate Pipeline Mappings

```bash
# For each CSV, generate a pipeline YAML
acp connect add csv

# Interactive prompts:
#   Source file: data/hubspot-companies.csv
#   Target context type: customer
#
#   Reading CSV headers: id, company_name, industry, annual_revenue,
#     health_score, account_owner, renewal_date, region, lifecycle_stage
#
#   Reading contexts/customer.yaml for field hints...
#
#   Auto-generated mapping:
#     attributes:
#       name: company_name
#       industry: industry
#     measures:
#       arr: annual_revenue
#       health_score: health_score
#     actors:
#       owner: account_owner
#     temporals:
#       renewal_date: renewal_date
#     locations:
#       region: region
#     processes:
#       lifecycle_stage: lifecycle_stage
#
#   Generated: pipelines/hubspot-companies-csv.yaml
#   Review and edit if needed.
```

### Review the Mapping

Open `pipelines/hubspot-companies-csv.yaml` and check:

```yaml
source:
  type: csv
  file: data/hubspot-companies.csv
target_context: customer
identity:
  source_ref_field: id                    # which column is the unique ID
  canonical_name_field: company_name      # which column is the display name
mapping:
  attributes:
    name: company_name
    industry: industry
  measures:
    arr: annual_revenue          # ← verify this is the right column
    health_score: health_score
  actors:
    owner: account_owner
  temporals:
    renewal_date: renewal_date   # ← verify date format (auto-coerced)
  locations:
    region: region
  processes:
    lifecycle_stage: lifecycle_stage
```

Common edits:
- Rename a mapping: your CSV says `acv` but the template field is `arr` → change the right side
- Remove a mapping: a CSV column isn't useful → delete the line
- Add a mapping the auto-mapper missed: a CSV column `churn_risk` should go to `intents.churn_risk` → add it

### Repeat for Other CSVs

```bash
# Add the invoices CSV
acp connect add csv
#   Source file: data/stripe-invoices.csv
#   Target context type: invoice
#   Generated: pipelines/stripe-invoices-csv.yaml
```

### Sync

```bash
acp connect sync
# → Validated 847 rows from hubspot-companies-csv.yaml
# → Synced 847 customers
# → Validated 2,341 rows from stripe-invoices-csv.yaml
# → Synced 2,341 invoices
```

### Verify

```bash
acp ctx list
# → customer: 847 entities
# → invoice: 2,341 entities

acp ctx get customer "Acme Corp"
# → Full 7-dimension profile

acp ctx search --type invoice --filter '{"context.attributes.status":{"eq":"overdue"}}'
# → Overdue invoices
```

### Connect an Agent and Use a Skill

```json
{ "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
```

For ad-hoc questions, just ask:
- "What's happening with Acme Corp?"
- "Which customers have ARR over $100K?"

For structured workflows, paste a skill prompt into a Claude Desktop Project:
- Open `skills/customer-health-monitor/examples/claude-project.md`
- Paste into Project system prompt
- Ask: "Run the health monitor"

### Your Project After Setup

```
my-ops/
├── acp.yaml
├── contexts/
│   ├── customer.yaml
│   └── invoice.yaml
├── pipelines/
│   ├── hubspot-companies-csv.yaml      # auto-generated, manually reviewed
│   └── stripe-invoices-csv.yaml        # auto-generated, manually reviewed
├── data/
│   ├── hubspot-companies.csv
│   └── stripe-invoices.csv
└── skills/
    ├── customer-health-monitor/
    └── invoice-collections-tracker/
```

---

## Scenario 3: Multiple Sources for the Same Entity (15 minutes)

Best for: Developers who have customer data in multiple systems (CRM + billing + support) and want a unified view.

This is ACP's core value — deep merging data from multiple sources into one pre-joined entity.

### Steps

```bash
acp init ~/projects/unified-customers
cd ~/projects/unified-customers
# Select: customer
```

### Add CSVs from Multiple Systems

```bash
cp ~/downloads/hubspot-companies.csv data/
cp ~/downloads/stripe-customers.csv data/
cp ~/downloads/zendesk-organizations.csv data/
```

### Generate a Pipeline for Each Source

```bash
# Pipeline 1: HubSpot → customer (CRM data)
acp connect add csv
#   Source: data/hubspot-companies.csv
#   Target: customer
#   Generated: pipelines/hubspot-csv.yaml
```

Edit `pipelines/hubspot-csv.yaml`:

```yaml
source:
  type: csv
  file: data/hubspot-companies.csv
target_context: customer
identity:
  source_ref_field: company_id
  canonical_name_field: company_name       # ← identity match key
mapping:
  attributes:
    name: company_name
    industry: industry
    segment: lifecycle_stage
  measures:
    deal_value: total_deal_value
  actors:
    owner: hubspot_owner_name
  temporals:
    created: created_date
    last_activity: last_activity_date
  processes:
    lifecycle_stage: lifecycle_stage
```

```bash
# Pipeline 2: Stripe → customer (billing data)
acp connect add csv
#   Source: data/stripe-customers.csv
#   Target: customer
#   Generated: pipelines/stripe-csv.yaml
```

Edit `pipelines/stripe-csv.yaml`:

```yaml
source:
  type: csv
  file: data/stripe-customers.csv
target_context: customer
identity:
  source_ref_field: stripe_customer_id
  canonical_name_field: customer_name      # ← SAME entity, matched by name
mapping:
  measures:
    mrr: monthly_recurring_revenue
    arr: annual_recurring_revenue
    lifetime_value: total_lifetime_value
  temporals:
    last_payment: last_charge_date
    subscription_start: subscription_created
  processes:
    subscription_status: subscription_status
    payment_status: last_payment_status
```

```bash
# Pipeline 3: Zendesk → customer (support data)
acp connect add csv
#   Source: data/zendesk-organizations.csv
#   Target: customer
#   Generated: pipelines/zendesk-csv.yaml
```

Edit `pipelines/zendesk-csv.yaml`:

```yaml
source:
  type: csv
  file: data/zendesk-organizations.csv
target_context: customer
identity:
  source_ref_field: zendesk_org_id
  canonical_name_field: organization_name  # ← SAME entity, matched by name
mapping:
  measures:
    open_cases: open_ticket_count
    nps: satisfaction_score
  temporals:
    last_support_contact: last_ticket_date
  intents:
    support_sentiment: overall_sentiment
```

### Sync All Three

```bash
acp connect sync
# → Synced 500 customers from hubspot-csv.yaml
# → Merged 480 customers from stripe-csv.yaml (480 matched by name, 20 new)
# → Merged 490 customers from zendesk-csv.yaml (490 matched, 10 new)
```

### What Happens During Merge

```
Pipeline 1 (HubSpot) creates the entity:
  "Acme Corp" → {
    attributes: { name, industry, segment },
    measures: { deal_value },
    actors: { owner },
    temporals: { created, last_activity },
    processes: { lifecycle_stage }
  }

Pipeline 2 (Stripe) merges INTO the same entity:
  "Acme Corp" → deep merge adds:
    measures: { mrr, arr, lifetime_value }     ← ADDED to existing measures
    temporals: { last_payment, subscription_start }  ← ADDED
    processes: { subscription_status, payment_status }  ← ADDED
    (deal_value, owner, industry — PRESERVED, not overwritten)

Pipeline 3 (Zendesk) merges again:
  "Acme Corp" → deep merge adds:
    measures: { open_cases, nps }              ← ADDED
    temporals: { last_support_contact }        ← ADDED
    intents: { support_sentiment }             ← ADDED (new dimension!)
    (everything from HubSpot + Stripe — PRESERVED)

Result: ONE entity with data from ALL THREE systems:
  {
    attributes: { name, industry, segment },
    measures: { deal_value, mrr, arr, lifetime_value, open_cases, nps },
    actors: { owner },
    temporals: { created, last_activity, last_payment, subscription_start, last_support_contact },
    intents: { support_sentiment },
    processes: { lifecycle_stage, subscription_status, payment_status }
  }
```

### Verify the Merge

```bash
acp ctx get customer "Acme Corp"
# → Shows the unified profile with data from all three sources
# → source_refs shows: hubspot:123, stripe:cus_abc, zendesk:org_99

acp ctx get customer "Acme Corp" | grep source_refs
# → [{ system: "csv", id: "123" }, { system: "csv", id: "cus_abc" }, ...]
```

### Ask the Agent a Cross-System Question

```
User: "Is Acme Corp at risk?"

Agent sees ONE unified profile:
  ARR: $480K (from Stripe)
  Health score: 34 (from HubSpot)
  Open cases: 3 (from Zendesk)
  NPS: 28 (from Zendesk)
  Renewal: 45 days (from HubSpot)
  Last payment: 2 days ago (from Stripe)

Agent: "Yes. Health score dropped to 34 with 3 open support cases
        and NPS at 28. Renewal is in 45 days. However, payments
        are current — last charge was 2 days ago. Recommend
        scheduling an emergency QBR and escalating support cases."
```

This answer is impossible with direct MCP connectors — it requires data from all three systems, pre-joined, in one call.

---

## Scenario 4: Custom Context Type (10 minutes)

Best for: Developers whose entities don't match any standard template — fleet vehicles, clinical trials, real estate properties, manufacturing runs, etc.

### Steps

```bash
acp init ~/projects/fleet-ops
cd ~/projects/fleet-ops
# Don't select any standard templates — we're creating our own
```

### Define a Custom Context Type

```bash
acp ctx define fleet-vehicle

# Interactive prompts:
#   Entity type name: fleet-vehicle
#   Description: Company vehicle with maintenance and assignment tracking
#
#   What fields in attributes? (comma-separated)
#     vin, make, model, year, color, license_plate, status
#
#   What fields in measures? (comma-separated)
#     mileage, fuel_level_pct, maintenance_score, days_since_service
#
#   What fields in actors? (comma-separated)
#     assigned_driver, fleet_manager, maintenance_provider
#
#   What fields in temporals? (comma-separated)
#     last_service, next_service_due, registration_expiry, last_inspection
#
#   What fields in locations? (comma-separated)
#     current_location, home_depot, assigned_region
#
#   What fields in intents? (comma-separated)
#     replacement_priority, disposal_reason
#
#   What fields in processes? (comma-separated)
#     service_status, assignment_status, inspection_status
#
#   What transaction types? (comma-separated)
#     service_completed, inspection_passed, inspection_failed,
#     driver_assigned, driver_unassigned, incident_reported, disposed
#
#   Generated: contexts/fleet-vehicle.yaml
```

### Review the Generated Template

```yaml
# contexts/fleet-vehicle.yaml
name: fleet-vehicle
type: entity
subtype: fleet-vehicle
description: "Company vehicle with maintenance and assignment tracking"
dimensions:
  attributes:
    vin: { type: string, description: "Vehicle identification number" }
    make: { type: string }
    model: { type: string }
    year: { type: number }
    color: { type: string }
    license_plate: { type: string }
    status: { type: string, enum: [active, maintenance, retired, disposed] }
  measures:
    mileage: { type: number }
    fuel_level_pct: { type: number }
    maintenance_score: { type: number }
    days_since_service: { type: number }
  actors:
    assigned_driver: { type: string }
    fleet_manager: { type: string }
    maintenance_provider: { type: string }
  temporals:
    last_service: { type: date }
    next_service_due: { type: date }
    registration_expiry: { type: date }
    last_inspection: { type: date }
  locations:
    current_location: { type: string }
    home_depot: { type: string }
    assigned_region: { type: string }
  intents:
    replacement_priority: { type: string, enum: [low, medium, high, urgent] }
    disposal_reason: { type: string }
  processes:
    service_status: { type: string, enum: [current, due_soon, overdue] }
    assignment_status: { type: string, enum: [assigned, unassigned, pool] }
    inspection_status: { type: string, enum: [passed, due, failed] }
transactionTypes:
  - service_completed
  - inspection_passed
  - inspection_failed
  - driver_assigned
  - driver_unassigned
  - incident_reported
  - disposed
```

Edit as needed — add fields, change types, adjust enums.

### Add Data and Map It

```bash
# Put your fleet data CSV in the data directory
cp ~/downloads/fleet-export.csv data/

# Generate the pipeline mapping
acp connect add csv
#   Source: data/fleet-export.csv
#   Target: fleet-vehicle
#   Auto-maps using your template field names as hints
#   Generated: pipelines/fleet-export-csv.yaml
```

Review `pipelines/fleet-export-csv.yaml`:

```yaml
source:
  type: csv
  file: data/fleet-export.csv
target_context: fleet-vehicle
identity:
  source_ref_field: vehicle_id
  canonical_name_field: vin
mapping:
  attributes:
    vin: vin_number
    make: manufacturer
    model: model_name
    year: model_year
    license_plate: plate_number
    status: vehicle_status
  measures:
    mileage: current_mileage
    fuel_level_pct: fuel_pct
    maintenance_score: maint_score
  actors:
    assigned_driver: driver_name
    fleet_manager: manager
  temporals:
    last_service: last_service_date
    next_service_due: next_service
    registration_expiry: reg_expiry
  locations:
    current_location: gps_location
    home_depot: depot_name
    assigned_region: region
  intents:
    replacement_priority: replace_priority
  processes:
    service_status: service_flag
    assignment_status: assign_status
```

### Sync and Query

```bash
acp connect sync
# → Synced 150 fleet-vehicle entities

acp ctx list
# → fleet-vehicle: 150 entities

acp ctx get fleet-vehicle "1HGCM82633A004352"
# → Full vehicle profile with all 7 dimensions

acp ctx search --type fleet-vehicle \
  --filter '{"context.processes.service_status":{"eq":"overdue"}}'
# → Vehicles needing service

acp ctx search --type fleet-vehicle \
  --filter '{"context.measures.mileage":{"gt":100000}}'
# → High-mileage vehicles
```

### Ask the Agent

```
"Which vehicles are overdue for service and have mileage over 100K?"
"Show me all vehicles in the Northeast region assigned to drivers"
"Any vehicles with registration expiring in the next 30 days?"
```

The agent uses the same MCP tools (`get_entity`, `search_entities`) regardless of whether the context type is a standard customer or a custom fleet vehicle. The 7-dimension schema works for any domain.

---

## Scenario 5: Adding a New Data Source to an Existing Project

Best for: You already have a project running and want to add data from a new system.

### Steps

```bash
cd ~/projects/my-ops

# You already have customers from HubSpot
# Now you want to add support case data from Zendesk

# Step 1: Add the context type (if not already selected)
acp ctx define case
# → Copies standard template to contexts/case.yaml
# → Or creates custom template interactively

# Step 2: Export data from Zendesk as CSV
cp ~/downloads/zendesk-tickets.csv data/

# Step 3: Generate the mapping
acp connect add csv
#   Source: data/zendesk-tickets.csv
#   Target: case
#   Generated: pipelines/zendesk-tickets-csv.yaml

# Step 4: Review the mapping
# Edit pipelines/zendesk-tickets-csv.yaml
# Make sure case.attributes.account maps to the customer name
# (this enables cross-entity queries)

# Step 5: Sync — only the new pipeline runs
acp connect sync
# → Existing customers: unchanged
# → New: 340 case entities synced

# Step 6: Verify cross-entity queries work
acp ctx search --type case \
  --filter '{"context.attributes.account":{"eq":"Acme Corp"}}'
# → Cases for Acme Corp
```

Now the agent can answer cross-entity questions:

```
"Which customers have more than 3 open support cases?"
"Is the support load increasing for our enterprise customers?"
"Acme Corp has a low health score — show me their open cases"
```

---

## Scenario 6: Re-syncing Updated Data

Best for: Your source data changed and you want to update ACP without losing existing context.

### Steps

```bash
cd ~/projects/my-ops

# Download a fresh export from HubSpot
cp ~/downloads/hubspot-companies-april.csv data/hubspot-companies.csv
# (overwrite the old file)

# Re-sync
acp connect sync
# → 847 customers: 812 updated, 35 unchanged, 0 new

# What happened:
#   - Entities matched by canonical_name (company name)
#   - Deep merge: new values override, missing keys preserved
#   - Change log: every changed field recorded with old/new values
#   - Agents polling changefeed see what changed
```

Check what changed:

```bash
acp changes --since 2026-04-01T00:00:00Z --types customer --limit 20
# → Shows which customers had field changes and what changed
```

**Key behavior:** re-syncing is safe. The deep merge preserves data that isn't in the update. If your new CSV doesn't include a `health_score` column that was in the previous sync, the existing health_score values are kept — not deleted.

---

## Scenario 7: Using a Skill

Best for: You have data loaded and want to run a structured business workflow.

### With Claude Desktop

```bash
# 1. Your data is already loaded (from any scenario above)
acp ctx list
# → customer: 847, invoice: 2341

# 2. Open the skill's Claude Desktop prompt
cat skills/customer-health-monitor/examples/claude-project.md

# 3. In Claude Desktop:
#    - Create a new Project
#    - Paste the prompt into the Project system prompt
#    - Connect ACP MCP server

# 4. Ask Claude:
#    "Run the health monitor"
#    "Check customer health for the last 24 hours"
#    "Any customers at risk?"

# 5. Claude will:
#    - Call get_context_changes to find what changed
#    - Call get_entity for each changed customer
#    - Assess risk using the skill's rules
#    - Call record_transaction to save assessments
#    - Summarize findings

# 6. Verify the recorded assessments
acp txn list --types risk_assessed
```

### Without a Skill (Ad-Hoc)

You don't need skills. Just connect Claude Desktop and ask:

```
"What's happening with Acme Corp?"
"Which invoices are overdue?"
"Compare our top 3 customers by ARR"
"What vendors have contracts expiring soon?"
```

Claude calls the MCP tools directly and reasons over whatever it finds. No skill needed. Skills add structure for recurring workflows — they're optional.

---

## Quick Reference: Which Scenario Am I In?

| I want to... | Scenario |
|-------------|----------|
| Just try ACP and see what it does | Scenario 1: Demo |
| Load my own business data | Scenario 2: Standard Template + CSV |
| Combine data from multiple systems | Scenario 3: Multiple Sources |
| Use ACP for a non-standard domain | Scenario 4: Custom Context Type |
| Add more data to an existing project | Scenario 5: Adding a New Source |
| Update ACP with fresh data | Scenario 6: Re-syncing |
| Run a structured business workflow | Scenario 7: Using a Skill |
