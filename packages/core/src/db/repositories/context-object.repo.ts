import pg from 'pg';
import { ContextObject, UpsertObjectRequest } from '../../models/context-object.js';
import { getPool } from '../client.js';
import { NotFoundError } from '../../errors.js';

function rowToContextObject(row: Record<string, unknown>): ContextObject {
  return {
    objectId: row.object_id as string,
    objectType: row.object_type as string,
    subtype: row.subtype as string,
    canonicalName: row.canonical_name as string,
    context: (row.context ?? {}) as ContextObject['context'],
    summary: row.summary as string | undefined,
    embedding: row.embedding as number[] | undefined,
    sourceRefs: (row.source_refs ?? []) as ContextObject['sourceRefs'],
    confidence: row.confidence as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export class ContextObjectRepo {
  private pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? getPool();
  }

  async findById(objectId: string): Promise<ContextObject> {
    const result = await this.pool.query(
      'SELECT * FROM context_objects WHERE object_id = $1',
      [objectId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('ContextObject', objectId);
    }
    return rowToContextObject(result.rows[0]);
  }

  async findBySourceKey(
    objectType: string,
    subtype: string,
    sourceSystem: string,
    sourceId: string,
  ): Promise<ContextObject | null> {
    const sourceKey = `${sourceSystem}:${sourceId}`;
    const result = await this.pool.query(
      `SELECT * FROM context_objects
       WHERE object_type = $1 AND subtype = $2
       AND ((source_refs #>> '{0,system}') || ':' || (source_refs #>> '{0,id}')) = $3`,
      [objectType, subtype, sourceKey],
    );
    return result.rows.length > 0 ? rowToContextObject(result.rows[0]) : null;
  }

  async findByName(subtype: string, name: string, limit = 5): Promise<ContextObject[]> {
    const result = await this.pool.query(
      `SELECT * FROM context_objects
       WHERE subtype = $1 AND canonical_name ILIKE '%' || $2 || '%'
       ORDER BY similarity(canonical_name, $2) DESC
       LIMIT $3`,
      [subtype, name, limit],
    );
    return result.rows.map(rowToContextObject);
  }

  async search(params: {
    type?: string;
    filters?: Record<string, Record<string, unknown>>;
    query?: string;
    limit?: number;
  }): Promise<ContextObject[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params.type) {
      conditions.push(`subtype = $${paramIdx++}`);
      values.push(params.type);
    }

    if (params.query) {
      conditions.push(`canonical_name ILIKE '%' || $${paramIdx++} || '%'`);
      values.push(params.query);
    }

    if (params.filters) {
      for (const [path, ops] of Object.entries(params.filters)) {
        const jsonPathText = path.split('.').reduce((acc, p, i, arr) => {
          return i === arr.length - 1 ? `${acc}->>'${p}'` : `${acc}->'${p}'`;
        }, 'context');

        for (const [op, val] of Object.entries(ops)) {
          const cast = typeof val === 'number' ? '::float' : '';
          switch (op) {
            case 'eq':
              conditions.push(`(${jsonPathText})${cast} = $${paramIdx++}`);
              values.push(val);
              break;
            case 'gt':
              conditions.push(`(${jsonPathText})${cast} > $${paramIdx++}`);
              values.push(val);
              break;
            case 'gte':
              conditions.push(`(${jsonPathText})${cast} >= $${paramIdx++}`);
              values.push(val);
              break;
            case 'lt':
              conditions.push(`(${jsonPathText})${cast} < $${paramIdx++}`);
              values.push(val);
              break;
            case 'lte':
              conditions.push(`(${jsonPathText})${cast} <= $${paramIdx++}`);
              values.push(val);
              break;
            case 'contains':
              conditions.push(`(${jsonPathText}) ILIKE '%' || $${paramIdx++} || '%'`);
              values.push(val);
              break;
          }
        }
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit ?? 10;
    values.push(limit);

    const result = await this.pool.query(
      `SELECT * FROM context_objects ${where} ORDER BY updated_at DESC LIMIT $${paramIdx}`,
      values,
    );
    return result.rows.map(rowToContextObject);
  }

  async upsert(
    req: UpsertObjectRequest,
    mergedContext: ContextObject['context'],
  ): Promise<{ objectId: string; status: 'created' | 'updated' }> {
    const result = await this.pool.query(
      `INSERT INTO context_objects (object_type, subtype, canonical_name, context, summary, source_refs, confidence)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7)
       ON CONFLICT (object_type, subtype, (((source_refs->0)->>'system') || ':' || ((source_refs->0)->>'id')))
       DO UPDATE SET
         canonical_name = EXCLUDED.canonical_name,
         context = $4,
         summary = COALESCE(EXCLUDED.summary, context_objects.summary),
         source_refs = EXCLUDED.source_refs,
         confidence = EXCLUDED.confidence,
         updated_at = NOW()
       RETURNING object_id, (xmax = 0) AS inserted`,
      [
        req.objectType,
        req.subtype,
        req.canonicalName,
        JSON.stringify(mergedContext),
        req.summary ?? null,
        JSON.stringify(req.sourceRefs),
        req.confidence ?? 1.0,
      ],
    );
    const row = result.rows[0];
    return {
      objectId: row.object_id,
      status: row.inserted ? 'created' : 'updated',
    };
  }

  async updateTimestamp(objectId: string): Promise<void> {
    await this.pool.query(
      'UPDATE context_objects SET updated_at = NOW() WHERE object_id = $1',
      [objectId],
    );
  }

  async findUpdatedSince(since: Date, types?: string[], limit = 50): Promise<ContextObject[]> {
    const conditions = ['updated_at > $1'];
    const values: unknown[] = [since.toISOString()];
    let paramIdx = 2;

    if (types && types.length > 0) {
      conditions.push(`subtype = ANY($${paramIdx++})`);
      values.push(types);
    }

    values.push(limit);

    const result = await this.pool.query(
      `SELECT * FROM context_objects WHERE ${conditions.join(' AND ')} ORDER BY updated_at ASC LIMIT $${paramIdx}`,
      values,
    );
    return result.rows.map(rowToContextObject);
  }
}
