import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const fieldSchema = z.object({
  type: z.string(),
  required: z.boolean().optional(),
  description: z.string(),
  enum: z.array(z.string()).optional(),
  items: z.string().optional(),
});

const templateSchema = z.object({
  template_id: z.string(),
  type: z.string(),
  subtype: z.string(),
  version: z.string(),
  description: z.string(),
  schema: z.record(z.record(fieldSchema)),
  transaction_types: z.array(z.string()),
});

export type FieldDefinition = z.infer<typeof fieldSchema>;
export type TemplateDefinition = z.infer<typeof templateSchema>;

function getStandardTemplatesDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // In dist: dist/util/template-loader.js -> ../../standard-templates
  // In src: src/util/template-loader.ts -> ../../standard-templates
  return join(__dirname, '..', '..', 'standard-templates');
}

function walkYamlFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...walkYamlFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

export function listStandardTemplates(): TemplateDefinition[] {
  const dir = getStandardTemplatesDir();
  return walkYamlFiles(dir).map((f) => {
    const raw = readFileSync(f, 'utf-8');
    return templateSchema.parse(parseYaml(raw));
  });
}

export function loadStandardTemplate(subtype: string): TemplateDefinition | null {
  const templates = listStandardTemplates();
  return templates.find((t) => t.subtype === subtype) ?? null;
}

export function loadProjectTemplates(contextsDir: string): TemplateDefinition[] {
  return walkYamlFiles(contextsDir).map((f) => {
    const raw = readFileSync(f, 'utf-8');
    return templateSchema.parse(parseYaml(raw));
  });
}
