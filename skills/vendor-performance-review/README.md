# Vendor Performance Review

Conducts periodic vendor assessments across delivery, quality, commercial, and relationship dimensions with contract renewal alerts. Correlates vendor profiles with invoice disputes and contract expiration dates to produce weighted scorecards and actionable recommendations.

## Why This Exists

Procurement teams typically perform vendor reviews quarterly using spreadsheets -- pulling delivery metrics from one system, invoice data from another, contract dates from a third, and manually computing scores. The result is stale by the time it reaches a review meeting, and the assessment trail lives in email threads and slide decks.

This skill runs monthly with full data correlation across vendor profiles, invoices, and contracts. Every assessment is recorded as a transaction, creating a continuous audit trail that tracks vendor performance trends over time. Other agents can poll the changefeed to discover new assessments and act on them.

## Scoring Dimensions

| Dimension | Weight | Primary Metric | Thresholds |
|-----------|--------|----------------|------------|
| Delivery | 30% | on_time_delivery_rate | >95% excellent, 90-95 acceptable, 85-90 concerning, <85 unacceptable |
| Quality | 25% | defect_rate | <1% excellent, 1-3 acceptable, 3-5 concerning, >5 unacceptable |
| Commercial | 25% | payment_terms + invoice accuracy | Composite of terms competitiveness and dispute rate |
| Relationship | 20% | compliance_status + risk_level | Compliance, strategic importance, risk classification |

Overall recommendation: >85 RENEW, 70-85 MAINTAIN, 55-70 IMPROVE, <55 REVIEW

## Context Types

| Type | Required | Purpose |
|------|----------|---------|
| vendor | Yes | Delivery metrics, quality rates, compliance status, contract dates |
| invoice | No | Invoice accuracy and dispute rate correlation |
| contract | No | Contract expiration dates for renewal alerts |

## How to Use

### With Claude Desktop

1. Connect ACP MCP server in `claude_desktop_config.json`:
   ```json
   { "mcpServers": { "acp": { "url": "http://localhost:3001/mcp" } } }
   ```
2. Create a new Project in Claude Desktop
3. Paste the contents of `examples/claude-project.md` into the Project system prompt
4. Ask: "Run the monthly vendor review" or "How are our vendors performing?" or "Any vendor contracts expiring soon?"

### With CrewAI

See `examples/crewai-agent.py` for a ready-to-use agent definition.

### Manually via CLI

```bash
# Step 1: Find active vendors
acp ctx search --type vendor \
  --filter '{"context.attributes.status":{"eq":"active"}}'

# Step 2: Get full profile for a specific vendor
acp ctx get vendor "CloudServe Inc"

# Step 3: Check invoices for dispute rate (if invoice data loaded)
acp ctx search --type invoice \
  --filter '{"context.attributes.vendor_name":{"eq":"CloudServe Inc"}}'

# Step 4: Check contract expiration (if contract data loaded)
acp ctx search --type contract \
  --filter '{"context.attributes.counterparty":{"eq":"CloudServe Inc"}}'

# Step 5: Review past assessments and issues
acp txn list --object-id <vendor-id> --types vendor_review,issue_reported

# Step 6: Record your assessment
acp txn add --object-id <vendor-id> --type vendor_review \
  --context '{"review_period":"2026-03-01 to 2026-03-31","overall_score":78,"overall_recommendation":"MAINTAIN","dimension_scores":{"delivery":85,"quality":72,"commercial":80,"relationship":70},"strengths":["On-time delivery at 96%","No compliance issues"],"concerns":["Defect rate trending up to 2.8%","3 issue reports this quarter"],"recommended_actions":["Request quality improvement plan","Schedule quarterly business review"],"contract_alert":"FLAG"}' \
  --actors '{"agent":"manual-review"}' \
  --measures '{"overall_score":78,"delivery_score":85,"quality_score":72,"commercial_score":80,"relationship_score":70,"annual_spend":240000,"days_until_contract_end":67,"issue_count":3}'

# Step 7: Verify it was recorded
acp txn list --object-id <vendor-id> --types vendor_review
```

## What Gets Recorded

Each assessment writes a `vendor_review` transaction:

```json
{
  "transactionType": "vendor_review",
  "context": {
    "review_period": "2026-03-01 to 2026-03-31",
    "overall_score": 78,
    "overall_recommendation": "MAINTAIN",
    "dimension_scores": {
      "delivery": 85,
      "quality": 72,
      "commercial": 80,
      "relationship": 70
    },
    "strengths": ["On-time delivery rate at 96%", "Full compliance, no regulatory issues"],
    "concerns": ["Defect rate increased from 1.2% to 2.8%", "3 issue reports filed this quarter"],
    "recommended_actions": ["Request formal quality improvement plan", "Schedule quarterly business review within 2 weeks"],
    "contract_alert": "FLAG"
  },
  "actors": { "agent": "vendor-performance-review", "vendor_owner": "Mike Torres" },
  "measures": { "overall_score": 78, "delivery_score": 85, "quality_score": 72, "commercial_score": 80, "relationship_score": 70, "annual_spend": 240000, "days_until_contract_end": 67, "issue_count": 3 }
}
```

These transactions are visible to other agents via the changefeed. A contract management agent can poll for `vendor_review` transactions with `contract_alert` = "URGENT" and initiate renewal workflows.

## APQC Reference

Category 11: Manage External Relationships -- 11.1.3 Assess Vendor Performance
