import type { RawRecord } from '../connectors/types.js';
import type { PipelineConfig } from './types.js';
import type { UpsertBody } from '../util/api-client.js';

const MEASURE_GROUPS = ['measures'];
const TEMPORAL_GROUPS = ['temporals'];

function coerceValue(value: string, group: string): unknown {
  if (value === '' || value === undefined || value === null) return undefined;

  if (MEASURE_GROUPS.includes(group)) {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }

  if (TEMPORAL_GROUPS.includes(group)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toISOString();
  }

  return value;
}

export function mapRecord(
  record: RawRecord,
  pipeline: PipelineConfig,
  sourceSystem: string,
): UpsertBody | null {
  const sourceId = record[pipeline.identity.source_ref_field];
  const canonicalName = record[pipeline.identity.canonical_name_field];

  if (!sourceId || !canonicalName) return null;

  const context: Record<string, Record<string, unknown>> = {};

  for (const [group, fieldMapping] of Object.entries(pipeline.mapping)) {
    context[group] = {};
    for (const [targetField, sourceColumn] of Object.entries(fieldMapping)) {
      const rawValue = record[sourceColumn];
      if (rawValue === undefined || rawValue === '') continue;
      const value = coerceValue(rawValue, group);
      if (value !== undefined) {
        context[group][targetField] = value;
      }
    }
    // Remove empty groups
    if (Object.keys(context[group]).length === 0) {
      delete context[group];
    }
  }

  return {
    objectType: 'entity',
    subtype: pipeline.target_context,
    canonicalName,
    context,
    sourceRefs: [{ system: sourceSystem, id: sourceId }],
  };
}
