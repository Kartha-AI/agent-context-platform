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
    `Search for entities matching criteria. Supports filtering by type, JSONB field values, and text search on names.

Context follows the same 7-dimension structure (attributes, measures, actors, temporals, locations, intents, processes). Use dot-path filters on any dimension:
- Numbers: { "context.measures.arr": { "gt": 100000 } }
- Dates: { "context.temporals.renewal_date": { "lt": "2026-06-01" } }
- Text: { "context.intents.churn_risk": { "eq": "high" } }
- Status: { "context.attributes.status": { "eq": "active" } }
- Process: { "context.processes.sla_status": { "eq": "at_risk" } }

Supported operators: eq, gt, gte, lt, lte, contains, in.
Text search on entity names uses fuzzy matching (trigram).
Results do not include transactions — use get_entity for full profiles.`,
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
    `Retrieve transaction history for an entity or across entities. Transactions represent events and decisions — cases opened, risk assessed, deals closed, invoices paid, vendor reviewed.

Each transaction has:
- transactionType: what happened (e.g., "risk_assessed", "case_opened")
- context: event-specific details (structured JSONB)
- actors: who was involved (agent name, person, system)
- measures: quantities involved (scores, amounts, counts)
- occurred_at: when it happened

Use to check recent activity, track trends, or find previous assessments.
Filter by objectId for one entity, or by transactionTypes across all entities.`,
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
    `Get entities that changed since a given timestamp. Designed for polling — call periodically to discover what changed and act on it.

Each change includes:
- change_type: created, updated, or transaction_added
- changes: what fields changed (path, previous value, current value)
- context_snapshot: key measures and temporals so you can reason about the change without calling get_entity

Returns changes in chronological order. Use the last change's timestamp as "since" for your next poll. This is how proactive agents work — poll for changes, evaluate, act, record decisions via record_transaction.`,
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
    `Record an event or decision for an entity. Use when you have assessed, decided, or taken action on an entity and want to record it so other agents and users can see it.

Common transaction types:
- risk_assessed: you evaluated an entity's risk level
- deal_risk_assessed: you reviewed a sales opportunity
- overdue_assessed: you flagged an overdue invoice
- escalation_assessed: you evaluated a case for escalation
- vendor_review: you scored a vendor's performance

Include structured context (your assessment), actors (who/what made the decision), and measures (relevant numbers). These transactions appear in the changefeed — other polling agents will discover them and can act on your findings.`,
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
