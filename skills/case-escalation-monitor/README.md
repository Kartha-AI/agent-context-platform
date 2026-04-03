# Case Escalation Monitor

Monitors support cases for escalation triggers using business context that traditional rule engines cannot access.

## Why This Exists

Ticketing systems (Zendesk, ServiceNow, Jira Service Management) have built-in escalation rules based on priority, SLA timers, and assignment. Those rules treat every customer the same. A critical bug for a $10K ARR customer and a critical bug for a $500K ARR customer approaching renewal get identical treatment.

The ACP knows customer ARR, health score, renewal date, and segment. This skill uses that cross-entity context to make escalation decisions that account for business impact, not just ticket metadata.

## What It Does

1. Polls for case changes in the last 2 hours
2. Finds cases with SLA status `at_risk` or `breached`
3. Enriches each case with customer context (ARR, health score, renewal date, segment)
4. Checks escalation and reopen history
5. Applies context-aware escalation rules with three severity levels (IMMEDIATE, RECOMMENDED, WATCH)
6. Records `escalation_assessed` transactions back to the ACP
7. Produces a prioritized summary

## Escalation Rules

**IMMEDIATE** — requires action now:
- Critical priority + customer ARR > $100K
- SLA breached (any case)
- Reopened 3+ times (systemic failure)

**RECOMMENDED** — should be escalated soon:
- SLA at risk + no first response + case age > 4 hours
- High priority + customer health score < 50
- Customer has 3+ simultaneous open cases

**WATCH** — monitor closely:
- Medium priority + no activity in 24 hours
- Enterprise customer + case age > 3 days

**Context adjustments** that modify thresholds:
- Customer health score < 50: all time thresholds reduced 50%
- Renewal within 90 days: urgency increased one level
- ARR > $250K: urgency increased one level

## Required Entity Types

- **case** (required) — support cases with priority, SLA status, category, reopen count
- **customer** (optional) — customer profiles with ARR, health score, segment, renewal date

## MCP Operations Used

| Operation | Purpose |
|-----------|---------|
| `get_context_changes` | Discover cases that changed since last run |
| `get_entity` | Get full case and customer profiles |
| `get_transactions` | Check escalation and reopen history |
| `record_transaction` | Write back `escalation_assessed` decisions |

## CLI Equivalent

```bash
# Run the escalation monitor via Claude Code CLI
claude -p "$(cat skills/case-escalation-monitor/prompt.md)"
```

Schedule with cron for automated operation:
```bash
# Every 2 hours during business hours
0 8-18/2 * * 1-5 claude -p "$(cat skills/case-escalation-monitor/prompt.md)" >> /var/log/escalation-monitor.log 2>&1
```

## Example Output Transaction

```json
{
  "objectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "transactionType": "escalation_assessed",
  "context": {
    "escalation_decision": "immediate",
    "reason": "SLA breached for enterprise customer Acme Corp (ARR $480K, health score 42, renewal in 45 days)",
    "recommended_actions": [
      "Assign to senior engineer immediately",
      "Notify customer success manager",
      "Schedule customer call within 4 hours"
    ],
    "case_summary": {
      "priority": "critical",
      "status": "open",
      "category": "bug",
      "age_hours": 6,
      "sla_status": "breached",
      "reopen_count": 0
    },
    "customer_context": {
      "name": "Acme Corp",
      "arr": 480000,
      "health_score": 42,
      "segment": "enterprise",
      "days_to_renewal": 45,
      "open_case_count": 2
    },
    "rules_triggered": [
      "critical_priority_high_arr",
      "sla_breached",
      "renewal_within_90_days_upgrade"
    ]
  },
  "actors": {
    "assessed_by": "case-escalation-monitor",
    "case_assignee": "jane.doe@company.com",
    "customer_owner": "john.smith@company.com"
  },
  "measures": {
    "urgency_score": 95,
    "hours_to_sla": -2,
    "customer_arr": 480000,
    "customer_health_score": 42
  }
}
```

## APQC Reference

- **Category:** 5. Manage Customer Service
- **Process:** 5.2.3 Manage Escalations
