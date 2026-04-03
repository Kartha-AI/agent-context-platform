"""
Invoice Collections Tracker — CrewAI Agent

Accounts Receivable Analyst agent that identifies overdue invoices,
assesses collection risk by aging bracket, cross-references customer
context, and recommends actions.

Requires: crewai, acp-sdk (or direct MCP tool calls)
"""

from datetime import datetime, timezone
from crewai import Agent, Task, Crew

# -- Agent Definition --

ar_analyst = Agent(
    role="Accounts Receivable Analyst",
    goal=(
        "Identify all overdue invoices, compute aging brackets, "
        "cross-reference customer context from the ACP, and recommend "
        "collection actions. Record an overdue_assessed transaction for "
        "each invoice."
    ),
    backstory=(
        "You are a senior AR analyst responsible for managing collections. "
        "You use the Agent Context Platform to pull invoice and customer data, "
        "apply aging bracket rules, and adjust recommendations based on "
        "customer segment, health score, and ARR. You never send automated "
        "dunning to enterprise customers. You escalate when total exposure "
        "exceeds $50K or health score drops below 50."
    ),
    tools=[],  # ACP MCP tools injected at runtime
    verbose=True,
)

# -- Task Definition --

collections_task = Task(
    description="""
    Run the daily invoice collections assessment:

    1. Call search_entities to find all invoices with status "overdue".
       Also search for "open" invoices and check if due_date is in the past.

    2. For each overdue invoice, compute days_overdue from context.temporals.due_date.
       Assign aging bracket:
       - 1-15 days: current (send reminder)
       - 16-30 days: late (follow-up call/email)
       - 31-60 days: delinquent (escalate to AR manager)
       - 60+ days: collections (collections review / legal hold)

    3. For each unique customer, call get_entity to fetch:
       - context.measures.health_score
       - context.measures.arr
       - context.attributes.segment
       - context.actors.owner

    4. Apply customer-context rules:
       - Enterprise segment: no automated dunning, personal outreach only
       - health_score > 70: automated reminder OK
       - health_score < 50: personal outreach required, flag as churn risk
       - ARR > $200K with any overdue: relationship risk flag
       - ARR > $500K and 30+ days overdue: escalate to VP Customer Success
       - Total customer exposure > $50K: escalate to finance leadership
       - Total customer exposure > $100K: flag for CFO review

    5. For each invoice, call record_transaction with:
       - transactionType: "overdue_assessed"
       - context: aging_bracket, days_overdue, recommended_action, notes, customer_context
       - actors: {"agent": "invoice-collections-tracker"}
       - measures: amount_due, days_overdue, total_customer_exposure

    6. Produce summary:
       - Total overdue count and value
       - Breakdown by aging bracket (count + value)
       - Top 5 highest-value overdue invoices
       - Relationship risk flags
       - Escalations (exposure > $50K, health < 50)
       - Customers without context in ACP
    """,
    expected_output=(
        "A structured AR aging report with total overdue count and value, "
        "breakdown by aging bracket, top 5 highest-value invoices, "
        "relationship risk flags, and escalation list. "
        "All overdue invoices have an overdue_assessed transaction recorded."
    ),
    agent=ar_analyst,
)

# -- Crew --

collections_crew = Crew(
    agents=[ar_analyst],
    tasks=[collections_task],
    verbose=True,
)

if __name__ == "__main__":
    result = collections_crew.kickoff()
    print(result)
