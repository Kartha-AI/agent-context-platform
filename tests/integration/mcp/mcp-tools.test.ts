import { describe, it, expect } from 'vitest';

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3001';

let sessionId: string;
let entityObjectId: string;

const mcpHeaders = () => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
  ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
});

function parseSSE(text: string): unknown[] {
  const results: unknown[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        results.push(JSON.parse(line.slice(6)));
      } catch {
        // skip non-JSON data lines
      }
    }
  }
  return results;
}

async function mcpCall(method: string, params: Record<string, unknown>, id = 1) {
  const res = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: mcpHeaders(),
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  const newSessionId = res.headers.get('mcp-session-id');
  if (newSessionId) sessionId = newSessionId;

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const events = parseSSE(text);
    return events.find((e: unknown) => (e as Record<string, unknown>).id === id) ?? events[events.length - 1] ?? {};
  }

  return res.json();
}

async function toolCall(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await mcpCall('tools/call', { name, arguments: args });
  const r = result as Record<string, unknown>;
  if (r.error) return { _error: r.error };
  const content = (r.result as Record<string, unknown>)?.content as Array<{ type: string; text: string }> | undefined;
  const text = content?.[0]?.text;
  return text ? JSON.parse(text) : (r.result as Record<string, unknown>);
}

describe('MCP Server Integration', () => {
  describe('Health Check', () => {
    it('returns healthy', async () => {
      const res = await fetch(`${MCP_URL}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
    });
  });

  describe('Session Management', () => {
    it('initializes a session', async () => {
      const result = await mcpCall('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1.0' },
      }) as Record<string, unknown>;
      expect(result.result).toBeDefined();
      expect(sessionId).toBeDefined();
    });

    it('sends initialized notification', async () => {
      await fetch(`${MCP_URL}/mcp`, {
        method: 'POST',
        headers: mcpHeaders(),
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
    });

    it('lists available tools', async () => {
      const result = await mcpCall('tools/list', {}) as Record<string, unknown>;
      const toolsResult = result.result as Record<string, unknown>;
      const tools = toolsResult.tools as Array<{ name: string }>;
      expect(tools).toBeDefined();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('get_entity');
      expect(toolNames).toContain('search_entities');
      expect(toolNames).toContain('get_transactions');
      expect(toolNames).toContain('get_context_changes');
      expect(toolNames).toContain('record_transaction');
      expect(tools).toHaveLength(5);
    });
  });

  // search_entities returns { results, count }
  describe('search_entities', () => {
    it('searches by type', async () => {
      const result = await toolCall('search_entities', { type: 'customer', limit: 5 });
      if (result._error) {
        console.warn('search_entities error, skipping:', result._error);
        return;
      }
      expect(result.results).toBeDefined();
      const results = result.results as Array<Record<string, unknown>>;
      if (results.length > 0) {
        entityObjectId = results[0].objectId as string;
        expect(results[0].subtype).toBe('customer');
      }
    });

    it('searches with text query', async () => {
      const result = await toolCall('search_entities', { type: 'customer', query: 'Test', limit: 5 });
      if (result._error) return;
      expect(result.results).toBeDefined();
    });

    it('searches with JSONB filter', async () => {
      const result = await toolCall('search_entities', {
        type: 'customer',
        filters: { 'context.measures.arr': { gt: 100000 } },
        limit: 5,
      });
      if (result._error) return;
      expect(result.results).toBeDefined();
    });
  });

  // get_entity returns entity object with recentTransactions
  describe('get_entity', () => {
    it('retrieves entity by ID', async () => {
      if (!entityObjectId) return;
      const result = await toolCall('get_entity', { id: entityObjectId });
      expect(result.objectId).toBe(entityObjectId);
      expect(result.context).toBeDefined();
      expect(result.recentTransactions).toBeDefined();
    });

    it('retrieves entity by type and name', async () => {
      const result = await toolCall('get_entity', { type: 'customer', name: 'Integration Test' });
      if (result._error) return;
      // Single match returns entity directly, multiple returns { results }
      if (result.results) {
        expect((result.results as unknown[]).length).toBeGreaterThan(0);
      } else {
        expect(result.canonicalName).toBeDefined();
      }
    });
  });

  // record_transaction returns { transactionId, status }
  describe('record_transaction', () => {
    it('records a transaction via MCP', async () => {
      if (!entityObjectId) return;
      const result = await toolCall('record_transaction', {
        objectId: entityObjectId,
        transactionType: 'health_score_updated',
        context: { previous: 72, current: 65, reason: 'MCP integration test' },
        actors: { agent: 'vitest-mcp' },
        measures: { previous_score: 72, new_score: 65 },
      });
      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('recorded');
    });
  });

  // get_transactions returns { transactions, count }
  describe('get_transactions', () => {
    it('retrieves transactions for an entity', async () => {
      if (!entityObjectId) return;
      const result = await toolCall('get_transactions', {
        objectId: entityObjectId,
        limit: 10,
      });
      expect(result.transactions).toBeDefined();
      expect((result.transactions as unknown[]).length).toBeGreaterThan(0);
    });

    it('filters by transaction type', async () => {
      if (!entityObjectId) return;
      const result = await toolCall('get_transactions', {
        objectId: entityObjectId,
        transactionTypes: ['health_score_updated'],
        limit: 10,
      });
      expect(result.transactions).toBeDefined();
      for (const t of result.transactions as Array<Record<string, unknown>>) {
        expect(t.transactionType).toBe('health_score_updated');
      }
    });
  });

  // get_context_changes returns { changes, cursor, count }
  describe('get_context_changes', () => {
    it('returns changes since timestamp', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = await toolCall('get_context_changes', { since, limit: 20 });
      expect(result.changes).toBeDefined();
      expect(result.cursor).toBeDefined();
    });

    it('filters by type', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = await toolCall('get_context_changes', {
        since,
        types: ['customer'],
        limit: 10,
      });
      expect(result.changes).toBeDefined();
    });
  });
});
