import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL ?? 'http://localhost:3002';
const API_KEY = process.env.API_KEY ?? 'dev-key';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

let objectId: string;
const testSourceId = `INT-${Date.now()}`;

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

describe('REST API Integration', () => {
  // -- Health --

  describe('GET /v1/health', () => {
    it('returns healthy status', async () => {
      const res = await fetch(`${API_URL}/v1/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
    });
  });

  // -- Auth --

  describe('Authentication', () => {
    it('rejects requests without auth header', async () => {
      const res = await fetch(`${API_URL}/v1/objects/stats`);
      expect(res.status).toBe(401);
    });

    it('rejects requests with invalid token', async () => {
      const res = await fetch(`${API_URL}/v1/objects/stats`, {
        headers: { 'Authorization': 'Bearer invalid-key' },
      });
      expect(res.status).toBe(401);
    });
  });

  // -- Upsert --

  describe('POST /v1/objects', () => {
    it('creates or updates an entity', async () => {
      const { status, data } = await api('POST', '/v1/objects', {
        objectType: 'entity',
        subtype: 'customer',
        canonicalName: 'Integration Test Corp',
        context: {
          attributes: { name: 'Integration Test Corp', industry: 'Technology', status: 'active' },
          measures: { arr: 250000, health_score: 72 },
          actors: { owner: 'Test User' },
          temporals: { renewal_date: '2026-12-01' },
        },
        sourceRefs: [{ system: 'test', id: testSourceId }],
      });
      expect([200, 201]).toContain(status);
      expect(data.objectId).toBeDefined();
      expect(['created', 'updated']).toContain(data.status);
      objectId = data.objectId;
    });

    it('updates existing entity on re-upsert (same source ref)', async () => {
      const { status, data } = await api('POST', '/v1/objects', {
        objectType: 'entity',
        subtype: 'customer',
        canonicalName: 'Integration Test Corp',
        context: {
          measures: { arr: 300000 },
        },
        sourceRefs: [{ system: 'test', id: testSourceId }],
      });
      expect(status).toBe(200);
      expect(data.status).toBe('updated');
      expect(data.objectId).toBe(objectId);
    });

    it('deep merges context on update', async () => {
      const { status, data } = await api('GET', `/v1/objects/${objectId}`);
      expect(status).toBe(200);
      expect(data.context.measures.arr).toBe(300000);
      expect(data.context.measures.health_score).toBe(72);
      expect(data.context.actors.owner).toBe('Test User');
    });

    it('accepts any JSONB context (schema-agnostic)', async () => {
      const { status, data } = await api('POST', '/v1/objects', {
        objectType: 'entity',
        subtype: 'custom-thing',
        canonicalName: 'Freeform Entity',
        context: {
          custom_dimension: { foo: 'bar', nested: { deep: true } },
        },
        sourceRefs: [{ system: 'test', id: `FREE-${Date.now()}` }],
      });
      expect([200, 201]).toContain(status);
      expect(data.objectId).toBeDefined();
    });

    it('rejects invalid request body', async () => {
      const { status } = await api('POST', '/v1/objects', {
        objectType: 'entity',
      });
      expect(status).toBe(400);
    });
  });

  // -- Bulk Upsert --

  describe('POST /v1/objects/bulk', () => {
    it('creates multiple entities', async () => {
      const { status, data } = await api('POST', '/v1/objects/bulk', {
        objects: [
          {
            objectType: 'entity',
            subtype: 'customer',
            canonicalName: 'Bulk Test A',
            context: { attributes: { name: 'Bulk Test A' }, measures: { arr: 100000 } },
            sourceRefs: [{ system: 'test', id: `BULK-A-${Date.now()}` }],
          },
          {
            objectType: 'entity',
            subtype: 'customer',
            canonicalName: 'Bulk Test B',
            context: { attributes: { name: 'Bulk Test B' }, measures: { arr: 50000 } },
            sourceRefs: [{ system: 'test', id: `BULK-B-${Date.now()}` }],
          },
        ],
      });
      expect(status).toBe(200);
      expect(data.results).toHaveLength(2);
      expect(data.errors).toHaveLength(0);
    });
  });

  // -- Get Object --

  describe('GET /v1/objects/:id', () => {
    it('returns entity with recent transactions', async () => {
      const { status, data } = await api('GET', `/v1/objects/${objectId}`);
      expect(status).toBe(200);
      expect(data.objectId).toBe(objectId);
      expect(data.canonicalName).toBe('Integration Test Corp');
      expect(data.recentTransactions).toBeDefined();
    });

    it('returns 404 for non-existent ID', async () => {
      const { status } = await api('GET', '/v1/objects/00000000-0000-0000-0000-000000000000');
      expect(status).toBe(404);
    });
  });

  // -- Stats --

  describe('GET /v1/objects/stats', () => {
    it('returns entity counts by type', async () => {
      const { status, data } = await api('GET', '/v1/objects/stats');
      expect(status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.total).toBeGreaterThan(0);
      const customerStat = data.stats.find((s: { subtype: string }) => s.subtype === 'customer');
      expect(customerStat).toBeDefined();
      expect(customerStat.count).toBeGreaterThan(0);
    });
  });

  // -- Search --

  describe('GET /v1/objects/search', () => {
    it('searches by type', async () => {
      const { status, data } = await api('GET', '/v1/objects/search?type=customer');
      expect(status).toBe(200);
      expect(data.results.length).toBeGreaterThan(0);
    });

    it('searches by text query', async () => {
      const { status, data } = await api('GET', '/v1/objects/search?type=customer&query=Integration');
      expect(status).toBe(200);
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0].canonicalName).toContain('Integration');
    });

    it('searches with JSONB filter', async () => {
      const filters = encodeURIComponent(JSON.stringify({ 'context.measures.arr': { gt: 200000 } }));
      const { status, data } = await api('GET', `/v1/objects/search?type=customer&filters=${filters}`);
      expect(status).toBe(200);
      for (const r of data.results) {
        expect(r.context.measures.arr).toBeGreaterThan(200000);
      }
    });

    it('respects limit parameter', async () => {
      const { data } = await api('GET', '/v1/objects/search?type=customer&limit=1');
      expect(data.results.length).toBeLessThanOrEqual(1);
    });
  });

  // -- Transactions --

  describe('POST /v1/objects/:id/txns', () => {
    it('records a transaction', async () => {
      const { status, data } = await api('POST', `/v1/objects/${objectId}/txns`, {
        transactionType: 'risk_assessed',
        context: { risk_level: 'medium', score: 65 },
        actors: { agent: 'integration-test' },
        measures: { current_health_score: 72 },
      });
      expect(status).toBe(201);
      expect(data.transactionId).toBeDefined();
      expect(data.status).toBe('recorded');
    });
  });

  describe('GET /v1/objects/:id/txns', () => {
    it('returns transactions for an entity', async () => {
      const { status, data } = await api('GET', `/v1/objects/${objectId}/txns`);
      expect(status).toBe(200);
      expect(data.transactions.length).toBeGreaterThan(0);
    });

    it('filters by transaction type', async () => {
      const { data } = await api('GET', `/v1/objects/${objectId}/txns?types=risk_assessed`);
      for (const t of data.transactions) {
        expect(t.transactionType).toBe('risk_assessed');
      }
    });
  });

  describe('GET /v1/objects/txns', () => {
    it('returns transactions across all entities', async () => {
      const { status, data } = await api('GET', '/v1/objects/txns?types=risk_assessed');
      expect(status).toBe(200);
      expect(data.transactions.length).toBeGreaterThan(0);
    });
  });

  // -- Changefeed --

  describe('GET /v1/objects/changes', () => {
    it('returns changes since timestamp', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { status, data } = await api('GET', `/v1/objects/changes?since=${since}`);
      expect(status).toBe(200);
      expect(data.changes).toBeDefined();
      expect(data.cursor).toBeDefined();
    });

    it('requires since parameter', async () => {
      const { status } = await api('GET', '/v1/objects/changes');
      expect(status).toBe(400);
    });

    it('filters by type', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { status, data } = await api('GET', `/v1/objects/changes?since=${since}&types=customer`);
      expect(status).toBe(200);
      for (const c of data.changes) {
        expect(c.subtype).toBe('customer');
      }
    });
  });
});
