import type { TemplateDefinition, FieldDefinition } from './template-loader.js';

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateContext(
  context: Record<string, unknown>,
  template: TemplateDefinition,
): ValidationResult {
  const errors: string[] = [];

  for (const [group, fields] of Object.entries(template.schema)) {
    const groupData = context[group] as Record<string, unknown> | undefined;

    for (const [fieldName, fieldDef] of Object.entries(fields as Record<string, FieldDefinition>)) {
      const value = groupData?.[fieldName];

      if (fieldDef.required && (value === undefined || value === null)) {
        errors.push(`${group}.${fieldName} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (!checkType(value, fieldDef)) {
        errors.push(`${group}.${fieldName}: expected ${fieldDef.type}, got ${typeof value}`);
        continue;
      }

      if (fieldDef.enum && typeof value === 'string' && !fieldDef.enum.includes(value)) {
        errors.push(`${group}.${fieldName}: '${value}' not in [${fieldDef.enum.join(', ')}]`);
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function checkType(value: unknown, def: FieldDefinition): boolean {
  switch (def.type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'date':
      return typeof value === 'string';
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}
