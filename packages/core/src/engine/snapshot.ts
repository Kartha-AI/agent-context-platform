import { ContextGroups } from '../models/context-object.js';

export function generateSnapshot(context: ContextGroups, changedPaths?: string[]): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};

  if (context.measures) {
    snapshot.measures = context.measures;
  }
  if (context.temporals) {
    snapshot.temporals = context.temporals;
  }

  const attributes = context.attributes as Record<string, unknown> | undefined;
  if (attributes?.flags) {
    snapshot.flags = attributes.flags;
  }

  if (changedPaths && changedPaths.length > 0) {
    const changedFields: Record<string, unknown> = {};
    for (const path of changedPaths) {
      const parts = path.split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined) {
        changedFields[path] = value;
      }
    }
    snapshot.changedFields = changedFields;
  }

  return snapshot;
}
