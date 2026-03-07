import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ContextObjectRepo, TransactionRepo } from '@acp/core';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);

    const objectId = event.pathParameters?.id;
    if (!objectId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Missing object ID' }),
      };
    }

    const objectRepo = new ContextObjectRepo();
    const txnRepo = new TransactionRepo();

    const entity = await objectRepo.findById(objectId);
    const recentTransactions = await txnRepo.findByObjectId(objectId, { limit: 10 });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entity, recentTransactions }),
    };
  } catch (err) {
    return handleError(err);
  }
};
