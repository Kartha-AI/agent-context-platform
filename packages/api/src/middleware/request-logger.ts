import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { childLogger, Logger } from '@acp/core';

export function createRequestLogger(event: APIGatewayProxyEventV2): Logger {
  return childLogger({
    requestId: event.requestContext?.requestId,
    method: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path,
  });
}
