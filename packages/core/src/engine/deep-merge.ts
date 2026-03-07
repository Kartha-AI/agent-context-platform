import { mergeWith } from 'lodash-es';
import { ContextGroups } from '../models/context-object.js';

function mergeCustomizer(objValue: unknown, srcValue: unknown): unknown {
  if (Array.isArray(srcValue)) {
    return srcValue;
  }
  if (srcValue === null) {
    return undefined;
  }
  return undefined;
}

export function deepMergeContext(
  existing: ContextGroups,
  update: ContextGroups,
): ContextGroups {
  const result = mergeWith({}, existing, update, mergeCustomizer);

  for (const key of Object.keys(result) as (keyof ContextGroups)[]) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }

  return result;
}
