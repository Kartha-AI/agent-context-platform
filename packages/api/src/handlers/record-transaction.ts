import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import {
  ContextObjectRepo,
  TransactionRepo,
  ChangeLogRepo,
  NotFoundError,
  ValidationError,
  generateSnapshot,
} from '@acp/core';
import { getTemplateValidator } from '@acp/templates';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';
import { createRequestLogger } from '../middleware/request-logger.js';

const txnSchema = z.object({
  transactionType: z.string(),
  context: z.record(z.unknown()),
  actors: z.record(z.unknown()).optional(),
  measures: z.record(z.unknown()).optional(),
  occurredAt: z.string().optional(),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);
    const log = createRequestLogger(event);

    const objectId = event.pathParameters?.id;
    if (!objectId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Missing object ID' }),
      };
    }

    const body = JSON.parse(event.body ?? '{}');
    const parsed = txnSchema.parse(body);

    const objectRepo = new ContextObjectRepo();
    const entity = await objectRepo.findById(objectId);

    const validator = getTemplateValidator();
    if (!validator.validateTransactionType(entity.objectType, entity.subtype, parsed.transactionType)) {
      throw new ValidationError(
        `Invalid transaction type '${parsed.transactionType}' for ${entity.objectType}/${entity.subtype}`,
      );
    }

    const txnRepo = new TransactionRepo();
    const transactionId = await txnRepo.insert(objectId, parsed);

    const changeLogRepo = new ChangeLogRepo();
    const snapshot = generateSnapshot(entity.context);
    await changeLogRepo.insert({
      objectId,
      objectType: entity.objectType,
      subtype: entity.subtype,
      changeType: 'transaction_added',
      contextSnapshot: { ...snapshot, transactionType: parsed.transactionType },
    });

    await objectRepo.updateTimestamp(objectId);

    log.info({ objectId, transactionId }, 'Transaction recorded');

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, status: 'recorded' }),
    };
  } catch (err) {
    return handleError(err);
  }
};
