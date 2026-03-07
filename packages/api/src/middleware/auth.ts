import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AcpError } from '@acp/core';

const API_KEYS = new Set(
  (process.env.API_KEYS ?? 'dev-key').split(',').map((k) => k.trim()),
);

export function validateAuth(event: APIGatewayProxyEventV2): void {
  const auth = event.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token || !API_KEYS.has(token)) {
    throw new AcpError('Unauthorized', 'UNAUTHORIZED', 401);
  }
}
