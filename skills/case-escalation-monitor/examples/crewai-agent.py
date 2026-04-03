"""
Case Escalation Monitor — CrewAI Agent

Support Escalation Analyst that reviews cases, applies context-aware
escalation logic using ACP business context, and records decisions.

Requires:
  - crewai
  - An MCP client configured to connect to the ACP MCP server
"""

from crewai import Agent, Task, Crew
from datetime import datetime, timedelta, timezone


# --- Agent Definition ---

escalation_analyst = Agent(
    role="Support Escalation Analyst",
    goal=(
        "Monitor support cases for escalation triggers using business context "
        "from the Agent Context Platform. Identify cases that need immediate "
        "attention, recommended escalation, or close monitoring. Record all "
        "escalation assessments back to the platform."
    ),
    backstory=(
        "You are a senior support operations analyst with deep expertise in "
        "escalation management. You understand that not all critical tickets "
        "are equal — a critical bug for a $500K ARR customer approaching "
        "renewal is fundamentally different from the same bug for a $10K "
        "customer. You use customer ARR, health scores, renewal dates, and "
        "segment data to make context-aware escalation decisions that "
        "traditional ticketing rule engines cannot."
    ),
    verbose=True,
    allow_delegation=False,
    # MCP tools are injected by the CrewAI MCP integration.
    # The agent expects these tools from the ACP MCP server:
    #   - get_context_changes
    #   - get_entity
    #   - search_entities
    #   - get_transactions
    #   - record_transaction
)


# --- Task Definition ---

since_timestamp = (
    datetime.now(timezone.utc) - timedelta(hours=2)
).isoformat()

escalation_review = Task(
    description=f"""
Review all support cases that changed in the last 2 hours and any cases
with SLA status "at_risk". Apply context-aware escalation rules and record
your assessments.

Steps:

1. Call get_context_changes with since="{since_timestamp}" to find cases
   that changed recently.

2. Call search_entities with type="case" and filter
   context.processes.sla_status="at_risk" to find slow-burn SLA risks.

3. Deduplicate results by object ID.

4. For each case:
   a. Call get_entity to get full case details.
   b. Look up the customer using search_entities with type="customer"
      and the case's account name from context.attributes.account.
   c. Call get_transactions for the case to check escalation and reopen
      history. Skip if already assessed in the last 2 hours.
   d. Apply escalation rules:
      - IMMEDIATE: critical priority + ARR > $100K, SLA breached,
        reopen_count >= 3
      - RECOMMENDED: SLA at_risk + no first_response + age > 4h,
        high priority + health_score < 50, customer has 3+ open cases
      - WATCH: medium priority + no activity 24h, enterprise + age > 3 days
   e. Apply context adjustments:
      - health_score < 50: reduce time thresholds by 50%
      - renewal within 90 days: upgrade urgency one level
      - ARR > $250K: upgrade urgency one level
   f. Call record_transaction with transactionType="escalation_assessed"
      including escalation_decision, reason, recommended_actions,
      case_summary, customer_context, and rules_triggered.

5. Produce a summary:
   - Total cases reviewed
   - IMMEDIATE escalations with case names, customers, and reasons
   - RECOMMENDED escalations with case names, customers, and reasons
   - WATCH list with case names, customers, and reasons
   - Cases with no action needed

Lead with IMMEDIATE items. Include specific numbers: ARR, health score,
days to renewal, hours to SLA deadline.
""",
    expected_output=(
        "A structured escalation report with cases grouped by severity "
        "(IMMEDIATE, RECOMMENDED, WATCH), each with business context "
        "explaining why the escalation level was assigned. All assessments "
        "recorded as escalation_assessed transactions in the ACP."
    ),
    agent=escalation_analyst,
)


# --- Crew Definition ---

escalation_crew = Crew(
    agents=[escalation_analyst],
    tasks=[escalation_review],
    verbose=True,
)


if __name__ == "__main__":
    result = escalation_crew.kickoff()
    print(result)
