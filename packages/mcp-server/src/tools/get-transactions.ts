import { TransactionRepo } from '@acp/core';

export const getTransactionsTool = {
  name: 'get_transactions',
  description:
    "Retrieve transaction history for an entity or across entities. Use when you need detailed activity history beyond what's included in the entity profile.",
  inputSchema: {
    type: 'object' as const,
    properties: {
      objectId: { type: 'string', description: 'Filter transactions for a specific entity' },
      transactionTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by transaction type(s)',
      },
      since: { type: 'string', description: 'ISO timestamp — only transactions after this time' },
      until: { type: 'string', description: 'ISO timestamp — only transactions before this time' },
      limit: { type: 'number', description: 'Max results, default 20' },
    },
  },
};

export async function handleGetTransactions(args: Record<string, unknown>): Promise<unknown> {
  const txnRepo = new TransactionRepo();

  const params = {
    types: args.transactionTypes as string[] | undefined,
    since: args.since ? new Date(args.since as string) : undefined,
    until: args.until ? new Date(args.until as string) : undefined,
    limit: (args.limit as number) ?? 20,
  };

  if (args.objectId) {
    const transactions = await txnRepo.findByObjectId(args.objectId as string, params);
    return { transactions, count: transactions.length };
  }

  const transactions = await txnRepo.findByTypes(params);
  return { transactions, count: transactions.length };
}
