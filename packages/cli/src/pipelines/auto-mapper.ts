import type { TemplateDefinition, FieldDefinition } from '../util/template-loader.js';

interface AutoMapping {
  mapping: Record<string, Record<string, string>>;
  unmapped: string[];
}

const COMMON_ALIASES: Record<string, string[]> = {
  name: ['company_name', 'company', 'account_name', 'full_name', 'display_name'],
  email: ['email_address', 'e_mail', 'contact_email'],
  phone: ['phone_number', 'telephone', 'mobile'],
  arr: ['annual_revenue', 'annual_recurring_revenue', 'revenue'],
  mrr: ['monthly_revenue', 'monthly_recurring_revenue'],
  health_score: ['healthscore', 'health', 'account_health'],
  nps: ['net_promoter_score', 'nps_score'],
  owner: ['account_owner', 'csm', 'manager', 'assigned_to'],
  status: ['account_status', 'state', 'current_status'],
  industry: ['vertical', 'sector'],
  country: ['nation', 'country_code'],
  region: ['territory', 'area', 'sales_region'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function autoMap(columns: string[], template: TemplateDefinition): AutoMapping {
  const mapping: Record<string, Record<string, string>> = {};
  const matched = new Set<string>();

  for (const [group, fields] of Object.entries(template.schema)) {
    mapping[group] = {};
    for (const [fieldName, fieldDef] of Object.entries(fields as Record<string, FieldDefinition>)) {
      const normalField = normalize(fieldName);

      // Try exact match
      let match = columns.find((c) => normalize(c) === normalField);

      // Try aliases
      if (!match) {
        const aliases = COMMON_ALIASES[fieldName] ?? [];
        match = columns.find((c) => aliases.includes(normalize(c)));
      }

      // Try description keyword match
      if (!match && fieldDef.description) {
        const descWords = normalize(fieldDef.description).split('_');
        match = columns.find((c) => {
          const cn = normalize(c);
          return descWords.some((w) => w.length > 3 && cn.includes(w));
        });
      }

      if (match && !matched.has(match)) {
        mapping[group][fieldName] = match;
        matched.add(match);
      }
    }

    if (Object.keys(mapping[group]).length === 0) {
      delete mapping[group];
    }
  }

  const unmapped = columns.filter((c) => !matched.has(c));
  return { mapping, unmapped };
}
