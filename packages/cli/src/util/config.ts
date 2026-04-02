import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const configSchema = z.object({
  api_url: z.string().default('http://localhost:3002'),
  api_key: z.string().default('dev-key'),
  project_name: z.string().optional(),
  demo: z.boolean().optional(),
  connectors: z.array(z.object({
    name: z.string(),
    pipeline: z.string(),
  })).optional(),
});

export type AcpConfig = z.infer<typeof configSchema>;

const CONFIG_FILENAME = 'acp.yaml';

export function findProjectRoot(from?: string): string | null {
  let dir = resolve(from ?? process.cwd());
  while (true) {
    if (existsSync(join(dir, CONFIG_FILENAME))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(from?: string): AcpConfig {
  const root = findProjectRoot(from);
  if (!root) {
    throw new Error(`No ${CONFIG_FILENAME} found. Run 'acp init' to create a project.`);
  }
  const raw = readFileSync(join(root, CONFIG_FILENAME), 'utf-8');
  const parsed = parseYaml(raw);
  return configSchema.parse(parsed);
}

export function getProjectRoot(from?: string): string {
  const root = findProjectRoot(from);
  if (!root) {
    throw new Error(`No ${CONFIG_FILENAME} found. Run 'acp init' to create a project.`);
  }
  return root;
}
