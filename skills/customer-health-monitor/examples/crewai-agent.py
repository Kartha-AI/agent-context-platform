"""
Customer Health Monitor — CrewAI Agent

Monitors customer health scores via Kartha ACP and creates
risk assessments when indicators decline.

Prerequisites:
  - Kartha ACP running (docker compose up)
  - Data loaded (acp connect sync)
  - CrewAI installed (pip install crewai)
  - MCP tools configured for CrewAI

Usage:
  python crewai-agent.py
"""

from crewai import Agent, Task, Crew
from pathlib import Path

# Load the skill prompt
skill_prompt = Path(__file__).parent.parent.joinpath("prompt.md").read_text()

# Define the agent
health_monitor = Agent(
    role="Customer Health Monitor",
    goal="Detect at-risk customers by monitoring health score changes and create structured risk assessments in ACP",
    backstory=skill_prompt,
    verbose=True,
    # Connect your MCP tools here:
    # tools=[acp_get_context_changes, acp_get_entity, acp_search_entities, acp_record_transaction],
)

# Define the task
monitor_task = Task(
    description=(
        "Check for customer health score changes in the last 6 hours. "
        "For each changed customer, retrieve their full profile, assess risk level "
        "(critical/high/medium/low), and record a risk_assessed transaction in ACP. "
        "Provide a summary of findings."
    ),
    agent=health_monitor,
    expected_output=(
        "A summary listing: total customers checked, breakdown by risk level, "
        "and the top 3 most urgent accounts with recommended actions."
    ),
)

# Run
if __name__ == "__main__":
    crew = Crew(
        agents=[health_monitor],
        tasks=[monitor_task],
        verbose=True,
    )
    result = crew.kickoff()
    print(result)
