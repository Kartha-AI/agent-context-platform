# Pipeline Risk Assessment

Reviews open sales opportunities, identifies stalled or at-risk deals, and produces prioritized action recommendations.

APQC: 3. Market and Sell Products and Services > 3.2.5 Manage Sales Pipeline

## What It Monitors

| Signal | Source Field | Threshold |
|--------|-------------|-----------|
| Stale deals | `context.temporals.last_activity` | No activity in 14+ days |
| Stage duration | `context.temporals.stage_changed` | Exceeds benchmark per stage |
| Missing champion | `context.actors.champion` | Empty or absent |
| Missing decision maker | `context.actors.decision_maker` | Empty or absent |
| Blind to competition | `context.intents.competitors` | Empty or absent |
| Missed close date | `context.temporals.close_date` | In the past |
| Urgent close | `context.temporals.close_date` | Within 14 days, wrong stage |
| Overvalued deal | `context.measures.amount` + `probability` | High amount, low probability |
| Customer health | Customer `context.measures.health_score` | Below 50 |

Stage duration benchmarks: prospecting 14d, qualification 21d, proposal 14d, negotiation 30d.

## Context Types

| Type | Required | Purpose |
|------|----------|---------|
| opportunity | Yes | Open deals with stage, amount, probability, close date |
| customer | No | Account health score for cross-reference |
| contact | No | Champion and decision maker identification |

## Output

Records a `deal_risk_assessed` transaction on each at-risk opportunity:

```json
{
  "transactionType": "deal_risk_assessed",
  "context": {
    "risk_level": "high",
    "risk_signals": [
      "No activity in 21 days",
      "No champion identified",
      "Close date in 8 days but stage is qualification"
    ],
    "recommended_actions": [
      "Schedule activity immediately",
      "Identify and engage champion",
      "Accelerate closing activities"
    ],
    "deal_summary": {
      "amount": 250000,
      "probability": 30,
      "days_in_stage": 28,
      "days_until_close": 8,
      "stage": "qualification"
    }
  },
  "actors": {
    "agent": "pipeline-risk-assessment",
    "deal_owner": "Sarah Chen"
  },
  "measures": {
    "deal_amount": 250000,
    "probability": 30,
    "days_in_stage": 28,
    "days_until_close": 8
  }
}
```

## How to Use

### Claude Desktop

Add the ACP MCP server to your Claude Desktop config, then copy the contents of `examples/claude-project.md` into a Claude Project as the system prompt.

Example messages:
- "Review the pipeline"
- "Any deals at risk?"
- "Prepare the weekly pipeline briefing"
- "How's the Acme Enterprise deal looking?"
- "Which deals are stale?"

### CrewAI

See `examples/crewai-agent.py` for a ready-to-run CrewAI agent configuration.

### CLI

Run the assessment manually against your ACP instance:

```bash
# Find all open opportunities
acp search --type opportunity --filter '{"context.attributes.status": {"eq": "open"}}'

# Get full detail on a specific deal
acp get --id <object_id>

# Check recent activity
acp transactions --object-id <object_id> --limit 10

# Record a risk assessment
acp record-transaction \
  --object-id <object_id> \
  --type deal_risk_assessed \
  --context '{"risk_level": "high", "risk_signals": ["No activity in 21 days"], "recommended_actions": ["Schedule activity immediately"], "deal_summary": {"amount": 250000, "probability": 30, "days_in_stage": 28, "days_until_close": 8, "stage": "qualification"}}'
```
