import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ContextObjectRepo } from '@acp/core';
import { validateAuth } from '../middleware/auth.js';
import { handleError } from '../middleware/error-handler.js';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateAuth(event);

    const qs = event.queryStringParameters ?? {};
    const type = qs.type;
    const query = qs.query;
    const limit = qs.limit ? Math.min(parseInt(qs.limit, 10), 100) : 10;
    const offset = qs.offset ? parseInt(qs.offset, 10) : undefined;

    let filters: Record<string, Record<string, unknown>> | undefined;
    if (qs.filters) {
      filters = JSON.parse(qs.filters);
    }

    const objectRepo = new ContextObjectRepo();
    const results = await objectRepo.search({ type, filters, query, limit, offset });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, count: results.length }),
    };
  } catch (err) {
    return handleError(err);
  }
};
