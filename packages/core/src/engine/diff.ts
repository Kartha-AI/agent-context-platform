import { FieldChange } from '../models/change-entry.js';

export function computeDiff(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
  prefix = '',
): FieldChange[] {
  const changes: FieldChange[] = [];

  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const prevVal = previous[key];
    const currVal = current[key];

    if (prevVal === currVal) continue;

    if (
      prevVal !== null &&
      currVal !== null &&
      typeof prevVal === 'object' &&
      typeof currVal === 'object' &&
      !Array.isArray(prevVal) &&
      !Array.isArray(currVal)
    ) {
      changes.push(
        ...computeDiff(
          prevVal as Record<string, unknown>,
          currVal as Record<string, unknown>,
          path,
        ),
      );
    } else if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
      changes.push({ path, previous: prevVal, current: currVal });
    }
  }

  return changes;
}
