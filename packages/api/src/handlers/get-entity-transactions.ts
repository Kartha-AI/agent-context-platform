import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { TransactionRepo, ValidationError } from '@acp/core';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);

    const objectId = event.pathParameters?.id;
    if (!objectId) {
      throw new ValidationError('Missing object ID');
    }

    const qs = event.queryStringParameters ?? {};
    const types = qs.types?.split(',');
    const since = qs.since ? new Date(qs.since) : undefined;
    const until = qs.until ? new Date(qs.until) : undefined;
    const limit = qs.limit ? parseInt(qs.limit, 10) : 20;

    const txnRepo = new TransactionRepo();
    const transactions = await txnRepo.findByObjectId(objectId, { types, since, until, limit });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    };
  } catch (err) {
    return handleError(err);
  }
};
