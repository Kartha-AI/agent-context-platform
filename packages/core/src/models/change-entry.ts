export interface FieldChange {
  path: string;
  previous: unknown;
  current: unknown;
}

export interface ChangeEntry {
  changeId: string;
  objectId: string;
  objectType: string;
  subtype: string;
  changeType: 'created' | 'updated' | 'transaction_added';
  changes?: FieldChange[];
  contextSnapshot?: Record<string, unknown>;
  changedAt: Date;
}
