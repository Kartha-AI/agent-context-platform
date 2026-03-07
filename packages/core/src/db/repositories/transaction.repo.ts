import pg from 'pg';
import { ContextTransaction, RecordTransactionRequest } from '../../models/context-transaction.js';
import { getPool } from '../client.js';

function rowToTransaction(row: Record<string, unknown>): ContextTransaction {
  return {
    transactionId: row.transaction_id as string,
    objectId: row.object_id as string,
    transactionType: row.transaction_type as string,
    occurredAt: new Date(row.occurred_at as string),
    context: (row.context ?? {}) as Record<string, unknown>,
    actors: row.actors as Record<string, unknown> | undefined,
    measures: row.measures as Record<string, unknown> | undefined,
    sourceRef: row.source_ref as ContextTransaction['sourceRef'],
    createdAt: new Date(row.created_at as string),
  };
}

export class TransactionRepo {
  private pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? getPool();
  }

  async findByObjectId(objectId: string, params?: {
    types?: string[];
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<ContextTransaction[]> {
    const conditions = ['object_id = $1'];
    const values: unknown[] = [objectId];
    let paramIdx = 2;

    if (params?.types && params.types.length > 0) {
      conditions.push(`transaction_type = ANY($${paramIdx++})`);
      values.push(params.types);
    }
    if (params?.since) {
      conditions.push(`occurred_at > $${paramIdx++}`);
      values.push(params.since.toISOString());
    }
    if (params?.until) {
      conditions.push(`occurred_at < $${paramIdx++}`);
      values.push(params.until.toISOString());
    }

    const limit = params?.limit ?? 20;
    values.push(limit);

    const result = await this.pool.query(
      `SELECT * FROM context_transactions WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC LIMIT $${paramIdx}`,
      values,
    );
    return result.rows.map(rowToTransaction);
  }

  async findByTypes(params: {
    types?: string[];
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<(ContextTransaction & { canonicalName: string; subtype: string })[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params.types && params.types.length > 0) {
      conditions.push(`t.transaction_type = ANY($${paramIdx++})`);
      values.push(params.types);
    }
    if (params.since) {
      conditions.push(`t.occurred_at > $${paramIdx++}`);
      values.push(params.since.toISOString());
    }
    if (params.until) {
      conditions.push(`t.occurred_at < $${paramIdx++}`);
      values.push(params.until.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit ?? 20;
    values.push(limit);

    const result = await this.pool.query(
      `SELECT t.*, o.canonical_name, o.subtype
       FROM context_transactions t
       JOIN context_objects o ON t.object_id = o.object_id
       ${where}
       ORDER BY t.occurred_at DESC
       LIMIT $${paramIdx}`,
      values,
    );
    return result.rows.map((row) => ({
      ...rowToTransaction(row),
      canonicalName: row.canonical_name as string,
      subtype: row.subtype as string,
    }));
  }

  async insert(objectId: string, req: RecordTransactionRequest, sourceRef?: Record<string, unknown>): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO context_transactions (object_id, transaction_type, occurred_at, context, actors, measures, source_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING transaction_id`,
      [
        objectId,
        req.transactionType,
        req.occurredAt ?? new Date().toISOString(),
        JSON.stringify(req.context),
        req.actors ? JSON.stringify(req.actors) : null,
        req.measures ? JSON.stringify(req.measures) : null,
        sourceRef ? JSON.stringify(sourceRef) : null,
      ],
    );
    return result.rows[0].transaction_id;
  }
}
