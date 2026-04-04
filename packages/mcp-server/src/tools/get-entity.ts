import { ContextObjectRepo, TransactionRepo } from '@acp/core';

export const getEntityTool = {
  name: 'get_entity',
  description:
    `Retrieve the full context profile for a business entity. Returns current state, recent transactions, and all context dimensions.

Context is organized into 7 dimensions:
- attributes: WHAT — identity facts (name, industry, status, segment)
- measures: HOW MUCH — numbers and KPIs (ARR, health_score, NPS, open_cases)
- actors: WHO — people and roles (owner, primary_contact, champion)
- temporals: WHEN — dates and deadlines (renewal_date, last_activity, contract_end)
- locations: WHERE — geography and channels (region, territory, timezone)
- intents: WHY — strategy and risk factors (churn_risk, competitors, expansion_potential)
- processes: HOW — current state and workflow (stage, onboarding_status, sla_status)

Navigation tips for common questions:
- Risk assessment: check measures + intents + temporals
- Who to contact: check actors
- Financial picture: check measures
- Urgency/deadlines: check temporals + processes
- Recent activity: check the recentTransactions array

Use id for direct lookup, or type + name for fuzzy name matching.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'The object_id UUID' },
      type: { type: 'string', description: "Entity type, e.g. 'customer', 'contact'" },
      name: { type: 'string', description: 'Entity name for fuzzy matching' },
    },
  },
};

export async function handleGetEntity(args: Record<string, unknown>): Promise<unknown> {
  const objectRepo = new ContextObjectRepo();
  const txnRepo = new TransactionRepo();

  if (args.id) {
    const entity = await objectRepo.findById(args.id as string);
    const recentTransactions = await txnRepo.findByObjectId(entity.objectId, { limit: 10 });
    return { ...entity, recentTransactions };
  }

  if (args.type && args.name) {
    const entities = await objectRepo.findByName(args.type as string, args.name as string, 5);
    if (entities.length === 0) {
      return { results: [], message: 'No entities found matching the criteria' };
    }
    if (entities.length === 1) {
      const recentTransactions = await txnRepo.findByObjectId(entities[0].objectId, { limit: 10 });
      return { ...entities[0], recentTransactions };
    }
    return { results: entities, message: `Found ${entities.length} matching entities` };
  }

  return { error: 'Provide either id, or type + name' };
}
