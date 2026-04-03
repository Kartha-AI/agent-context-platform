"""
Vendor Performance Review -- CrewAI Agent

Procurement Performance Analyst that reviews active vendors, scores them
across delivery/quality/commercial/relationship dimensions, and records
assessments as vendor_review transactions in the Agent Context Platform.

Requirements:
    pip install crewai crewai-tools mcp
"""

from crewai import Agent, Task, Crew
from crewai_tools import MCPServerAdapter

# Connect to the ACP MCP server
mcp = MCPServerAdapter(server_url="http://localhost:3001/mcp")
acp_tools = mcp.get_tools()

# -- Agent Definition --

vendor_analyst = Agent(
    role="Procurement Performance Analyst",
    goal=(
        "Assess all active vendors across delivery, quality, commercial, and "
        "relationship dimensions. Produce weighted scorecards, flag contract "
        "renewal risks, and record structured assessments for audit trail."
    ),
    backstory=(
        "You are a senior procurement analyst responsible for vendor performance "
        "management. You evaluate vendors monthly using quantitative metrics -- "
        "on-time delivery rates, defect rates, invoice accuracy, compliance "
        "status -- and produce actionable scorecards. You correlate vendor "
        "profiles with invoice disputes and contract expiration dates to give "
        "procurement leadership a complete picture. Every assessment you produce "
        "is recorded as a transaction so other agents and teams can track vendor "
        "performance trends over time."
    ),
    tools=acp_tools,
    verbose=True,
)

# -- Task Definition --

vendor_review_task = Task(
    description="""
    Conduct the monthly vendor performance review:

    1. Call search_entities with type "vendor" and filter context.attributes.status = "active"
       to find all active vendors.

    2. For each vendor, call get_entity to retrieve the full profile.

    3. If invoice data is available, call search_entities with type "invoice" and filter
       context.attributes.vendor_name matching the vendor name. Calculate invoice accuracy
       as (total - disputed) / total.

    4. If contract data is available, call search_entities with type "contract" and filter
       context.attributes.counterparty matching the vendor name. Extract expiration dates.

    5. Call get_transactions with the vendor's objectId and transactionTypes
       ["vendor_review", "issue_reported"] to check previous assessments and quality issues.

    6. Score each vendor on four dimensions:
       - Delivery (30%): on_time_delivery_rate thresholds and lead time trends
       - Quality (25%): defect_rate thresholds and issue_reported count
       - Commercial (25%): payment terms competitiveness and invoice accuracy
       - Relationship (20%): compliance status and risk level

    7. Compute weighted overall score and determine recommendation:
       >85 RENEW, 70-85 MAINTAIN, 55-70 IMPROVE, <55 REVIEW

    8. Check contract expiration: within 30 days = URGENT, within 90 days = FLAG.
       If replaceable and score <70, recommend sourcing alternatives.

    9. Call record_transaction for each vendor with transactionType "vendor_review"
       including overall_score, dimension_scores, strengths, concerns,
       recommended_actions, and contract_alert.

    10. Produce a summary with:
        - Total vendors reviewed
        - Breakdown by recommendation tier
        - Top performers with highlights
        - Vendors requiring attention with primary concerns
        - Contract alerts for expirations within 90 days
        - Total annual spend across reviewed vendors
    """,
    expected_output=(
        "A structured vendor performance report with individual scorecards "
        "and a portfolio summary. Each vendor has scores across four dimensions, "
        "an overall weighted score, a recommendation, and contract renewal status. "
        "All assessments are recorded as vendor_review transactions in the platform."
    ),
    agent=vendor_analyst,
)

# -- Crew Execution --

crew = Crew(
    agents=[vendor_analyst],
    tasks=[vendor_review_task],
    verbose=True,
)

if __name__ == "__main__":
    result = crew.kickoff()
    print(result)
