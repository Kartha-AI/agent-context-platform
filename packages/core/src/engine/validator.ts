import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface ContextTemplate {
  templateId: string;
  objectType: string;
  subtype: string;
  version: string;
  description: string;
  schema: {
    attributes?: Record<string, unknown>;
    measures?: Record<string, unknown>;
    actors?: Record<string, unknown>;
    temporals?: Record<string, unknown>;
    locations?: Record<string, unknown>;
    intents?: Record<string, unknown>;
    processes?: Record<string, unknown>;
  };
  transactionTypes: string[];
  definitions?: Record<string, Record<string, unknown>>;
}

export class TemplateValidator {
  private ajv: Ajv;
  private validators = new Map<string, ValidateFunction>();
  private templates = new Map<string, ContextTemplate>();

  constructor() {
    this.ajv = new Ajv({ allErrors: true, coerceTypes: false });
    addFormats(this.ajv);
  }

  registerTemplate(template: ContextTemplate): void {
    const key = `${template.objectType}:${template.subtype}`;
    this.templates.set(key, template);

    const properties: Record<string, unknown> = {};
    for (const [group, schema] of Object.entries(template.schema)) {
      if (schema) {
        properties[group] = schema;
      }
    }

    const jsonSchema = {
      type: 'object',
      properties,
      additionalProperties: true,
      ...(template.definitions ? { definitions: template.definitions } : {}),
    };

    const validate = this.ajv.compile(jsonSchema);
    this.validators.set(key, validate);
  }

  getTemplate(objectType: string, subtype: string): ContextTemplate | undefined {
    return this.templates.get(`${objectType}:${subtype}`);
  }

  validate(
    objectType: string,
    subtype: string,
    context: Record<string, unknown>,
  ): { valid: boolean; errors?: string[] } {
    const key = `${objectType}:${subtype}`;
    const validate = this.validators.get(key);

    if (!validate) {
      return { valid: true };
    }

    const valid = validate(context);
    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map(
          (e) => `${e.instancePath || '/'}: ${e.message}`,
        ),
      };
    }

    return { valid: true };
  }

  validateTransactionType(objectType: string, subtype: string, transactionType: string): boolean {
    const template = this.templates.get(`${objectType}:${subtype}`);
    if (!template) return true;
    return template.transactionTypes.includes(transactionType);
  }
}
