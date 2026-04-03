# Invoice Collections Tracker

Identifies overdue invoices, groups them by customer, cross-references business context from the ACP, and recommends collection actions based on aging brackets and customer profile.

**APQC Reference:** 8.3.4 Manage Collections

## What it does

1. Searches for all invoices with status "overdue" or with a `due_date` in the past
2. Computes days overdue and assigns an aging bracket (1-15 current, 16-30 late, 31-60 delinquent, 60+ collections)
3. Fetches customer profiles to get health score, ARR, segment, and account owner
4. Applies context-aware rules (enterprise customers get personal outreach, high-ARR customers get relationship-risk flags, exposure > $50K triggers escalation)
5. Records an `overdue_assessed` transaction on each invoice
6. Produces an AR aging summary with escalations and risk flags

## Required entity types

- **invoice** (required) — must have `context.attributes.status`, `context.temporals.due_date`, `context.measures.amount_due`
- **customer** (optional) — used for `health_score`, `arr`, `segment`, `owner`

## ACP operations used

- `search_entities` — find overdue and open invoices
- `get_entity` — fetch customer profile for context
- `record_transaction` — write back the `overdue_assessed` assessment

## Trigger

Run daily in the morning, or before AR review meetings. Can also be triggered manually.

## CLI equivalent

```bash
# Step 1: Find overdue invoices
acp search --type invoice --filter 'context.attributes.status=overdue' --limit 100

# Step 2: Find open invoices that may be past due
acp search --type invoice --filter 'context.attributes.status=open' --limit 100

# Step 3: Get customer context for a specific customer
acp get --type customer --id <customer_id>

# Step 4: Record assessment on an invoice
acp record-txn --object-id <invoice_id> --type overdue_assessed --context '{
  "aging_bracket": "late",
  "days_overdue": 22,
  "recommended_action": "Follow-up call via account owner",
  "notes": "Enterprise customer, health_score 65.",
  "customer_context": {
    "customer_name": "Acme Corp",
    "health_score": 65,
    "arr": 480000,
    "segment": "enterprise",
    "owner": "Sarah Chen",
    "total_exposure": 35000
  }
}'
```

## Example transaction JSON

```json
{
  "objectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "transactionType": "overdue_assessed",
  "context": {
    "aging_bracket": "delinquent",
    "days_overdue": 45,
    "recommended_action": "Escalate to AR manager. Enterprise customer — no automated dunning.",
    "notes": "Health score 42, below threshold. Personal outreach required. Total exposure $72K exceeds $50K threshold — escalate to finance.",
    "customer_context": {
      "customer_name": "GlobalTech Industries",
      "health_score": 42,
      "arr": 320000,
      "segment": "enterprise",
      "owner": "Mike Torres",
      "total_exposure": 72000
    }
  },
  "actors": {
    "agent": "invoice-collections-tracker"
  },
  "measures": {
    "amount_due": 28500,
    "days_overdue": 45,
    "total_customer_exposure": 72000
  }
}
```

## Aging bracket rules

| Days Overdue | Bracket | Default Action |
|---|---|---|
| 1-15 | current | Payment reminder |
| 16-30 | late | Follow-up call or email |
| 31-60 | delinquent | Escalate to AR manager |
| 60+ | collections | Collections review / legal hold |

## Customer context overrides

- **Enterprise segment**: No automated dunning. Personal outreach only.
- **Health score < 50**: Personal outreach required. Flag as churn risk.
- **ARR > $200K + overdue**: Relationship risk flag.
- **Total exposure > $50K**: Escalate to finance leadership.
