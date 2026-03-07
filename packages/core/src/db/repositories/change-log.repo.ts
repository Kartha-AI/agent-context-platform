import pg from 'pg';
import { ChangeEntry, FieldChange } from '../../models/change-entry.js';
import { getPool } from '../client.js';

function rowToChangeEntry(row: Record<string, unknown>): ChangeEntry {
  return {
    changeId: row.change_id as string,
    objectId: row.object_id as string,
    objectType: row.object_type as string,
    subtype: row.subtype as string,
    changeType: row.change_type as ChangeEntry['changeType'],
    changes: row.changes as FieldChange[] | undefined,
    contextSnapshot: row.context_snapshot as Record<string, unknown> | undefined,
    changedAt: new Date(row.changed_at as string),
  };
}

export class ChangeLogRepo {
  private pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? getPool();
  }

  async insert(entry: {
    objectId: string;
    objectType: string;
    subtype: string;
    changeType: ChangeEntry['changeType'];
    changes?: FieldChange[];
    contextSnapshot?: Record<string, unknown>;
  }): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO change_log (object_id, object_type, subtype, change_type, changes, context_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING change_id`,
      [
        entry.objectId,
        entry.objectType,
        entry.subtype,
        entry.changeType,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.contextSnapshot ? JSON.stringify(entry.contextSnapshot) : null,
      ],
    );
    return result.rows[0].change_id;
  }

  async findSince(since: Date, params?: {
    types?: string[];
    limit?: number;
  }): Promise<ChangeEntry[]> {
    const conditions = ['changed_at > $1'];
    const values: unknown[] = [since.toISOString()];
    let paramIdx = 2;

    if (params?.types && params.types.length > 0) {
      conditions.push(`subtype = ANY($${paramIdx++})`);
      values.push(params.types);
    }

    const limit = params?.limit ?? 50;
    values.push(limit);

    const result = await this.pool.query(
      `SELECT * FROM change_log WHERE ${conditions.join(' AND ')} ORDER BY changed_at ASC LIMIT $${paramIdx}`,
      values,
    );
    return result.rows.map(rowToChangeEntry);
  }
}
