import {
  ContextObjectRepo,
  TransactionRepo,
  ChangeLogRepo,
  generateSnapshot,
  NotFoundError,
  ValidationError,
} from '@acp/core';
import { getTemplateValidator } from '@acp/templates';

export const recordTransactionTool = {
  name: 'record_transaction',
  description:
    'Record an event or decision for an entity. Use when your agent has assessed, decided, or taken action on an entity and wants to record this for other agents to see.',
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

  const validator = getTemplateValidator();
  if (!validator.validateTransactionType(entity.objectType, entity.subtype, args.transactionType as string)) {
    throw new ValidationError(
      `Invalid transaction type '${args.transactionType}' for ${entity.objectType}/${entity.subtype}`,
    );
  }

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
