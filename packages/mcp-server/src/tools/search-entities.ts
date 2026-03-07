import { ContextObjectRepo } from '@acp/core';

export const searchEntitiesTool = {
  name: 'search_entities',
  description:
    'Search for entities matching criteria. Supports filtering by type, JSONB field values, and text search on names. Use when you need to find entities matching specific conditions.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: { type: 'string', description: "Filter by subtype, e.g. 'customer'" },
      filters: {
        type: 'object',
        description:
          "JSONB path filters, e.g. { 'context.measures.arr': { 'gt': 100000 } }",
      },
      query: { type: 'string', description: 'Text search on canonical_name' },
      limit: { type: 'number', description: 'Max results, default 10' },
    },
  },
};

export async function handleSearchEntities(args: Record<string, unknown>): Promise<unknown> {
  const objectRepo = new ContextObjectRepo();
  const results = await objectRepo.search({
    type: args.type as string | undefined,
    filters: args.filters as Record<string, Record<string, unknown>> | undefined,
    query: args.query as string | undefined,
    limit: (args.limit as number) ?? 10,
  });
  return { results, count: results.length };
}
