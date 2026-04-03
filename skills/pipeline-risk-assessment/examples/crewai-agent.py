"""
Pipeline Risk Assessment - CrewAI Agent

Requires:
  pip install crewai crewai-tools requests

Configure ACP_MCP_URL to point to your ACP MCP server endpoint.
"""

import os
from pathlib import Path
from crewai import Agent, Task, Crew
from crewai_tools import tool
import requests

ACP_MCP_URL = os.environ.get("ACP_MCP_URL", "http://localhost:3001")


def _call_tool(tool_name: str, arguments: dict) -> dict:
    """Call an ACP MCP tool via the Streamable HTTP transport."""
    response = requests.post(
        ACP_MCP_URL,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        },
        headers={"Content-Type": "application/json"},
    )
    response.raise_for_status()
    return response.json().get("result", {})


@tool("search_entities")
def search_entities(type: str, filters: dict = None, query: str = None, limit: int = 50) -> dict:
    """Search for entities matching criteria in the Agent Context Platform."""
    args = {"type": type, "limit": limit}
    if filters:
        args["filters"] = filters
    if query:
        args["query"] = query
    return _call_tool("search_entities", args)


@tool("get_entity")
def get_entity(id: str = None, type: str = None, name: str = None) -> dict:
    """Retrieve the full context profile for a business entity."""
    args = {}
    if id:
        args["id"] = id
    if type:
        args["type"] = type
    if name:
        args["name"] = name
    return _call_tool("get_entity", args)


@tool("get_transactions")
def get_transactions(
    objectId: str = None,
    transactionTypes: list = None,
    since: str = None,
    until: str = None,
    limit: int = 10,
) -> dict:
    """Retrieve transaction history for an entity."""
    args = {"limit": limit}
    if objectId:
        args["objectId"] = objectId
    if transactionTypes:
        args["transactionTypes"] = transactionTypes
    if since:
        args["since"] = since
    if until:
        args["until"] = until
    return _call_tool("get_transactions", args)


@tool("record_transaction")
def record_transaction(
    objectId: str,
    transactionType: str,
    context: dict,
    actors: dict = None,
    measures: dict = None,
) -> dict:
    """Record an event or decision for an entity."""
    args = {
        "objectId": objectId,
        "transactionType": transactionType,
        "context": context,
    }
    if actors:
        args["actors"] = actors
    if measures:
        args["measures"] = measures
    return _call_tool("record_transaction", args)


# Load the prompt from prompt.md
prompt_path = Path(__file__).parent.parent / "prompt.md"
skill_prompt = prompt_path.read_text()

pipeline_analyst = Agent(
    role="Sales Pipeline Analyst",
    goal="Review all open sales opportunities, identify stalled or at-risk deals, classify risk levels, and produce prioritized action recommendations.",
    backstory=(
        "You are an experienced sales operations analyst who specializes in pipeline "
        "hygiene and deal risk assessment. You know the warning signs of stalled deals: "
        "no recent activity, missing champions, overvalued probabilities, and approaching "
        "close dates with insufficient stage progression. You use data to surface risks "
        "early so sales leadership can intervene before deals slip."
    ),
    tools=[search_entities, get_entity, get_transactions, record_transaction],
    verbose=True,
)

pipeline_review_task = Task(
    description=skill_prompt,
    expected_output=(
        "A structured pipeline risk report containing:\n"
        "1. Total deals reviewed\n"
        "2. Breakdown by risk level (critical, high, medium, low)\n"
        "3. Top 5 deals needing immediate attention with risk signals and recommended actions\n"
        "4. Total pipeline value at risk\n"
        "5. Deals with missed close dates\n"
        "6. Confirmation that deal_risk_assessed transactions were recorded for all at-risk deals"
    ),
    agent=pipeline_analyst,
)

crew = Crew(
    agents=[pipeline_analyst],
    tasks=[pipeline_review_task],
    verbose=True,
)

if __name__ == "__main__":
    result = crew.kickoff()
    print(result)
