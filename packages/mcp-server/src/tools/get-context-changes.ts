import { ChangeLogRepo } from '@acp/core';

export const getContextChangesTool = {
  name: 'get_context_changes',
  description:
    `Get entities that changed since a given timestamp. Designed for polling — call periodically to discover what changed and act on it.

Each change includes:
- change_type: created, updated, or transaction_added
- changes: what fields changed (path, previous value, current value)
- context_snapshot: key measures and temporals so you can reason about the change without calling get_entity

Returns changes in chronological order. Use the last change's timestamp as "since" for your next poll. This is how proactive agents work — poll for changes, evaluate, act, record decisions via record_transaction.`,
  inputSchema: {
    type: 'object' as const,
    required: ['since'],
    properties: {
      since: { type: 'string', description: 'ISO timestamp — changes after this time' },
      types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by entity subtype(s)',
      },
      limit: { type: 'number', description: 'Max results, default 50' },
    },
  },
};

export async function handleGetContextChanges(args: Record<string, unknown>): Promise<unknown> {
  const changeLogRepo = new ChangeLogRepo();
  const since = new Date(args.since as string);

  const changes = await changeLogRepo.findSince(since, {
    types: args.types as string[] | undefined,
    limit: (args.limit as number) ?? 50,
  });

  const cursor =
    changes.length > 0
      ? changes[changes.length - 1].changedAt.toISOString()
      : (args.since as string);

  return { changes, cursor, count: changes.length };
}
