import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ContextObjectRepo } from '@acp/core';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);

    const objectRepo = new ContextObjectRepo();
    const stats = await objectRepo.getStats();
    const total = stats.reduce((sum, s) => sum + s.count, 0);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats, total }),
    };
  } catch (err) {
    return handleError(err);
  }
};
