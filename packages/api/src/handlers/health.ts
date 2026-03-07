import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getPool } from '@acp/core';

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }),
    };
  } catch {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unhealthy', timestamp: new Date().toISOString() }),
    };
  }
};
