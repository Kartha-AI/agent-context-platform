import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import {
  ContextObjectRepo,
  ChangeLogRepo,
  ValidationError,
  deepMergeContext,
  computeDiff,
  generateSnapshot,
  logger,
} from '@acp/core';
import { getTemplateValidator } from '@acp/templates';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';

const sourceRefSchema = z.object({
  system: z.string(),
  id: z.string(),
  object: z.string().optional(),
  url: z.string().optional(),
  lastSyncedAt: z.string().optional(),
});

const objectSchema = z.object({
  objectType: z.string(),
  subtype: z.string(),
  canonicalName: z.string(),
  context: z.record(z.unknown()).default({}),
  summary: z.string().optional(),
  sourceRefs: z.array(sourceRefSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

const bulkSchema = z.object({
  objects: z.array(objectSchema).min(1).max(100),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);

    const body = JSON.parse(event.body ?? '{}');
    const parsed = bulkSchema.parse(body);

    const objectRepo = new ContextObjectRepo();
    const changeLogRepo = new ChangeLogRepo();
    const validator = getTemplateValidator();

    const results: { objectId: string; status: 'created' | 'updated' }[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < parsed.objects.length; i++) {
      const obj = parsed.objects[i];
      try {
        const validation = validator.validate(obj.objectType, obj.subtype, obj.context);
        if (!validation.valid) {
          errors.push({ index: i, error: `Validation failed: ${validation.errors?.join(', ')}` });
          continue;
        }

        const sourceRef = obj.sourceRefs[0];
        const existing = await objectRepo.findBySourceKey(
          obj.objectType,
          obj.subtype,
          sourceRef.system,
          sourceRef.id,
        );

        const mergedContext = existing
          ? deepMergeContext(existing.context, obj.context)
          : obj.context;

        const changes = existing
          ? computeDiff(
              existing.context as Record<string, unknown>,
              mergedContext as Record<string, unknown>,
            )
          : [];

        const result = await objectRepo.upsert(
          {
            objectType: obj.objectType,
            subtype: obj.subtype,
            canonicalName: obj.canonicalName,
            context: mergedContext,
            summary: obj.summary,
            sourceRefs: obj.sourceRefs,
            confidence: obj.confidence,
          },
          mergedContext,
        );

        const snapshot = generateSnapshot(mergedContext, changes.map((c) => c.path));
        await changeLogRepo.insert({
          objectId: result.objectId,
          objectType: obj.objectType,
          subtype: obj.subtype,
          changeType: result.status,
          changes: changes.length > 0 ? changes : undefined,
          contextSnapshot: snapshot,
        });

        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ index: i, error: message });
        logger.warn({ index: i, err }, 'Bulk upsert item failed');
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, errors }),
    };
  } catch (err) {
    return handleError(err);
  }
};
