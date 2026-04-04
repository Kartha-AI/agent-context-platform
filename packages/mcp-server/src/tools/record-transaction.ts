import {
  ContextObjectRepo,
  TransactionRepo,
  ChangeLogRepo,
  generateSnapshot,
} from '@acp/core';

export const recordTransactionTool = {
  name: 'record_transaction',
  description:
    `Record an event or decision for an entity. Use when you have assessed, decided, or taken action on an entity and want to record it so other agents and users can see it.

Common transaction types:
- risk_assessed: you evaluated an entity's risk level
- deal_risk_assessed: you reviewed a sales opportunity
- overdue_assessed: you flagged an overdue invoice
- escalation_assessed: you evaluated a case for escalation
- vendor_review: you scored a vendor's performance

Include structured context (your assessment), actors (who/what made the decision), and measures (relevant numbers). These transactions appear in the changefeed — other polling agents will discover them and can act on your findings.`,
  inputSchema: {
    type: 'object' as const,
    required: ['objectId', 'transactionType', 'context'],
    properties: {
      objectId: { type: 'string', description: 'The entity this transaction relates to' },
      transactionType: {
        type: 'string',
        description: "Type of event, e.g. 'risk_assessed', 'escalation_created'",
      },
      context: { type: 'object', description: 'Transaction details' },
      actors: { type: 'object', description: 'Who was involved (agent name, user, etc.)' },
      measures: { type: 'object', description: 'Any quantities involved' },
    },
  },
};

export async function handleRecordTransaction(args: Record<string, unknown>): Promise<unknown> {
  const objectRepo = new ContextObjectRepo();
  const txnRepo = new TransactionRepo();
  const changeLogRepo = new ChangeLogRepo();

  const entity = await objectRepo.findById(args.objectId as string);

  const transactionId = await txnRepo.insert(
    args.objectId as string,
    {
      transactionType: args.transactionType as string,
      context: (args.context ?? {}) as Record<string, unknown>,
      actors: args.actors as Record<string, unknown> | undefined,
      measures: args.measures as Record<string, unknown> | undefined,
    },
    { system: 'agent', object: 'mcp-server' },
  );

  const snapshot = generateSnapshot(entity.context);
  await changeLogRepo.insert({
    objectId: args.objectId as string,
    objectType: entity.objectType,
    subtype: entity.subtype,
    changeType: 'transaction_added',
    contextSnapshot: { ...snapshot, transactionType: args.transactionType },
  });

  await objectRepo.updateTimestamp(args.objectId as string);

  return { transactionId, status: 'recorded' };
}
