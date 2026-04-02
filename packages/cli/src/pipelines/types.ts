import { z } from 'zod';

export const pipelineConfigSchema = z.object({
  source: z.object({
    type: z.string(),
    file: z.string(),
  }),
  target_context: z.string(),
  identity: z.object({
    source_ref_field: z.string(),
    canonical_name_field: z.string(),
  }),
  mapping: z.record(z.record(z.string())),
});

export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;
