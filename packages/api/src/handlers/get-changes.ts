import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ChangeLogRepo, ValidationError } from '@acp/core';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);

    const since = event.queryStringParameters?.since;
    if (!since) {
      throw new ValidationError('Missing required query parameter: since');
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      throw new ValidationError('Invalid ISO timestamp for "since"');
    }

    const types = event.queryStringParameters?.types?.split(',');
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 50;

    const changeLogRepo = new ChangeLogRepo();
    const changes = await changeLogRepo.findSince(sinceDate, { types, limit });

    const cursor = changes.length > 0
      ? changes[changes.length - 1].changedAt.toISOString()
      : since;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes, cursor }),
    };
  } catch (err) {
    return handleError(err);
  }
};
