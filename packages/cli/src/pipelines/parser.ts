import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { pipelineConfigSchema, type PipelineConfig } from './types.js';

export function parsePipelineYaml(filePath: string): PipelineConfig {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(raw);
  return pipelineConfigSchema.parse(parsed);
}
