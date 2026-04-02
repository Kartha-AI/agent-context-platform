export interface UpsertBody {
  objectType: string;
  subtype: string;
  canonicalName: string;
  context: Record<string, unknown>;
  sourceRefs: { system: string; id: string; object?: string }[];
  summary?: string;
  confidence?: number;
}

export interface RecordTransactionBody {
  transactionType: string;
  context: Record<string, unknown>;
  actors?: Record<string, unknown>;
  measures?: Record<string, unknown>;
}

export class AcpApiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getHealth(): Promise<{ status: string }> {
    return this.request('GET', '/v1/health');
  }

  async getStats(): Promise<{ stats: { subtype: string; count: number }[]; total: number }> {
    return this.request('GET', '/v1/objects/stats');
  }

  async getObject(id: string): Promise<unknown> {
    return this.request('GET', `/v1/objects/${id}`);
  }

  async searchObjects(params: {
    type?: string;
    query?: string;
    filters?: Record<string, Record<string, unknown>>;
    limit?: number;
    offset?: number;
  }): Promise<{ results: unknown[]; count: number }> {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.query) qs.set('query', params.query);
    if (params.filters) qs.set('filters', JSON.stringify(params.filters));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    return this.request('GET', `/v1/objects/search?${qs}`);
  }

  async upsertObject(body: UpsertBody): Promise<{ objectId: string; status: string }> {
    return this.request('POST', '/v1/objects', body);
  }

  async bulkUpsert(objects: UpsertBody[]): Promise<{ results: unknown[]; errors: unknown[] }> {
    return this.request('POST', '/v1/objects/bulk', { objects });
  }

  async getTransactions(params: {
    objectId?: string;
    types?: string[];
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<{ transactions: unknown[] }> {
    if (params.objectId) {
      const qs = new URLSearchParams();
      if (params.types) qs.set('types', params.types.join(','));
      if (params.since) qs.set('since', params.since);
      if (params.until) qs.set('until', params.until);
      if (params.limit) qs.set('limit', String(params.limit));
      return this.request('GET', `/v1/objects/${params.objectId}/txns?${qs}`);
    }
    const qs = new URLSearchParams();
    if (params.types) qs.set('types', params.types.join(','));
    if (params.since) qs.set('since', params.since);
    if (params.until) qs.set('until', params.until);
    if (params.limit) qs.set('limit', String(params.limit));
    return this.request('GET', `/v1/objects/txns?${qs}`);
  }

  async recordTransaction(objectId: string, body: RecordTransactionBody): Promise<{ transactionId: string; status: string }> {
    return this.request('POST', `/v1/objects/${objectId}/txns`, body);
  }

  async getChanges(params: {
    since: string;
    types?: string[];
    limit?: number;
  }): Promise<{ changes: unknown[]; cursor: string }> {
    const qs = new URLSearchParams();
    qs.set('since', params.since);
    if (params.types) qs.set('types', params.types.join(','));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.request('GET', `/v1/objects/changes?${qs}`);
  }
}
