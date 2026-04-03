# Customer Health Monitor

Continuously monitors customer health scores and creates structured risk assessments when indicators decline. Correlates health score changes with support activity, engagement trends, and upcoming milestones.

## What It Monitors

- Health score changes (drops, trends)
- NPS declines
- Open support case accumulation
- Approaching renewal dates with declining health
- Activity gaps (no engagement in 30+ days)

## Context Types

| Type | Required | Purpose |
|------|----------|---------|
| customer | Yes | Health scores, ARR, NPS, renewal dates, account owners |
| case | No | Open support cases for correlation |
| contact | No | Engagement signals from contacts |

## How to Use

### With Claude Desktop

1. Connect ACP MCP server in `claude_desktop_config.json`:
   ```json
   { "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
   ```
2. Create a new Project in Claude Desktop
3. Paste the contents of `examples/claude-project.md` into the Project system prompt
4. Ask: "Check customer health" or "Run the health monitor" or "Any customers at risk?"

### With CrewAI

See `examples/crewai-agent.py` for a ready-to-use agent definition.

### Manually via CLI

```bash
# Step 1: Check what changed
acp changes --since 2026-03-28T00:00:00Z --types customer

# Step 2: Get full profile for a flagged customer
acp ctx get customer "Acme Corp"

# Step 3: Check for open cases (if case data is loaded)
acp ctx search --type case \
  --filter '{"context.attributes.account":{"eq":"Acme Corp"},"context.attributes.status":{"eq":"open"}}'

# Step 4: Record your assessment
acp txn add --object-id <customer-id> --type risk_assessed \
  --context '{"risk_level":"high","score":42,"factors":["Health dropped from 87 to 34","3 open cases","Renewal in 45 days"],"recommended_actions":["Schedule emergency QBR","Escalate critical case"],"urgency":"immediate"}' \
  --actors '{"agent":"manual-review"}'

# Step 5: Verify it was recorded
acp txn list --object-id <customer-id> --types risk_assessed
```

## What Gets Recorded

Each assessment writes a `risk_assessed` transaction:

```json
{
  "transactionType": "risk_assessed",
  "context": {
    "risk_level": "high",
    "score": 42,
    "factors": ["Health score dropped from 87 to 34 in 7 days", "3 open support cases", "Renewal in 45 days"],
    "recommended_actions": ["Schedule emergency QBR", "Escalate critical case"],
    "urgency": "immediate"
  },
  "actors": { "agent": "customer-health-monitor", "account_owner": "Sarah Chen" },
  "measures": { "previous_health_score": 87, "current_health_score": 34, "days_until_renewal": 45, "open_case_count": 3 }
}
```

These transactions are visible to other agents via the changefeed. An escalation agent can poll for `risk_assessed` transactions and act on them.

## APQC Reference

Category 3: Market and Sell Products and Services → 3.3.4 Manage Customer Health
