import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import { AcpError, logger } from '@acp/core';

export function handleError(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof ZodError) {
    logger.warn({ errors: err.errors }, 'Validation error');
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      }),
    };
  }

  if (err instanceof AcpError) {
    if (err.statusCode >= 500) {
      logger.error({ err, code: err.code }, err.message);
    } else {
      logger.warn({ code: err.code, details: err.details }, err.message);
    }
    return {
      statusCode: err.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      }),
    };
  }

  logger.error({ err }, 'Unhandled error');
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Internal server error' }),
  };
}
