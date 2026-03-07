import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleGetEntity } from './tools/get-entity.js';
import { handleSearchEntities } from './tools/search-entities.js';
import { handleGetTransactions } from './tools/get-transactions.js';
import { handleGetContextChanges } from './tools/get-context-changes.js';
import { handleRecordTransaction } from './tools/record-transaction.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agent-context-platform',
    version: '0.1.0',
  });

  server.tool(
    'get_entity',
    'Retrieve the full context profile for a business entity. Returns current state, recent activity, and all context dimensions. Use when you need comprehensive information about a specific entity.',
    {
      id: z.string().optional().describe('The object_id UUID'),
      type: z.string().optional().describe("Entity type, e.g. 'customer', 'contact'"),
      name: z.string().optional().describe('Entity name for fuzzy matching'),
    },
    async (args) => {
      const result = await handleGetEntity(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'search_entities',
    'Search for entities matching criteria. Supports filtering by type, JSONB field values, and text search on names.',
    {
      type: z.string().optional().describe("Filter by subtype, e.g. 'customer'"),
      filters: z.record(z.record(z.unknown())).optional().describe("JSONB path filters, e.g. { 'context.measures.arr': { 'gt': 100000 } }"),
      query: z.string().optional().describe('Text search on canonical_name'),
      limit: z.number().optional().describe('Max results, default 10'),
    },
    async (args) => {
      const result = await handleSearchEntities(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_transactions',
    "Retrieve transaction history for an entity or across entities. Use when you need detailed activity history beyond what's included in the entity profile.",
    {
      objectId: z.string().optional().describe('Filter transactions for a specific entity'),
      transactionTypes: z.array(z.string()).optional().describe('Filter by transaction type(s)'),
      since: z.string().optional().describe('ISO timestamp — only transactions after this time'),
      until: z.string().optional().describe('ISO timestamp — only transactions before this time'),
      limit: z.number().optional().describe('Max results, default 20'),
    },
    async (args) => {
      const result = await handleGetTransactions(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_context_changes',
    'Get entities that changed since a given timestamp. Designed for polling agents that wake up periodically to check for changes.',
    {
      since: z.string().describe('ISO timestamp — changes after this time'),
      types: z.array(z.string()).optional().describe('Filter by entity subtype(s)'),
      limit: z.number().optional().describe('Max results, default 50'),
    },
    async (args) => {
      const result = await handleGetContextChanges(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'record_transaction',
    'Record an event or decision for an entity. Use when your agent has assessed, decided, or taken action on an entity and wants to record this for other agents to see.',
    {
      objectId: z.string().describe('The entity this transaction relates to'),
      transactionType: z.string().describe("Type of event, e.g. 'risk_assessed', 'escalation_created'"),
      context: z.record(z.unknown()).describe('Transaction details'),
      actors: z.record(z.unknown()).optional().describe('Who was involved (agent name, user, etc.)'),
      measures: z.record(z.unknown()).optional().describe('Any quantities involved'),
    },
    async (args) => {
      const result = await handleRecordTransaction(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}
