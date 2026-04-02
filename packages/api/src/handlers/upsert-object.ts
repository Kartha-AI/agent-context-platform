import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import {
  ContextObjectRepo,
  ChangeLogRepo,
  deepMergeContext,
  computeDiff,
  generateSnapshot,
} from '@acp/core';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';
import { createRequestLogger } from '../middleware/request-logger.js';

const sourceRefSchema = z.object({
  system: z.string(),
  id: z.string(),
  object: z.string().optional(),
  url: z.string().optional(),
  lastSyncedAt: z.string().optional(),
});

const upsertSchema = z.object({
  objectType: z.string(),
  subtype: z.string(),
  canonicalName: z.string(),
  context: z.record(z.unknown()).default({}),
  summary: z.string().optional(),
  sourceRefs: z.array(sourceRefSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);
    const log = createRequestLogger(event);

    const body = JSON.parse(event.body ?? '{}');
    const parsed = upsertSchema.parse(body);

    const objectRepo = new ContextObjectRepo();
    const changeLogRepo = new ChangeLogRepo();

    const sourceRef = parsed.sourceRefs[0];
    const existing = await objectRepo.findBySourceKey(
      parsed.objectType,
      parsed.subtype,
      sourceRef.system,
      sourceRef.id,
    );

    const mergedContext = existing
      ? deepMergeContext(existing.context, parsed.context)
      : parsed.context;

    const changes = existing
      ? computeDiff(
          existing.context as Record<string, unknown>,
          mergedContext as Record<string, unknown>,
        )
      : [];

    const result = await objectRepo.upsert(
      {
        objectType: parsed.objectType,
        subtype: parsed.subtype,
        canonicalName: parsed.canonicalName,
        context: mergedContext,
        summary: parsed.summary,
        sourceRefs: parsed.sourceRefs,
        confidence: parsed.confidence,
      },
      mergedContext,
    );

    const snapshot = generateSnapshot(
      mergedContext,
      changes.map((c) => c.path),
    );

    await changeLogRepo.insert({
      objectId: result.objectId,
      objectType: parsed.objectType,
      subtype: parsed.subtype,
      changeType: result.status,
      changes: changes.length > 0 ? changes : undefined,
      contextSnapshot: snapshot,
    });

    log.info({ objectId: result.objectId, status: result.status }, 'Object upserted');

    return {
      statusCode: result.status === 'created' ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return handleError(err);
  }
};
