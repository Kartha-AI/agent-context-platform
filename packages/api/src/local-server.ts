import { createServer, IncomingMessage, ServerResponse } from 'http';
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { logger, getPool, runMigrations } from '@acp/core';
import { handler as upsertHandler } from './handlers/upsert-object.js';
import { handler as bulkUpsertHandler } from './handlers/bulk-upsert.js';
import { handler as getObjectHandler } from './handlers/get-object.js';
import { handler as recordTxnHandler } from './handlers/record-transaction.js';
import { handler as getChangesHandler } from './handlers/get-changes.js';
import { handler as healthHandler } from './handlers/health.js';
import { handler as getStatsHandler } from './handlers/get-stats.js';
import { handler as searchObjectsHandler } from './handlers/search-objects.js';
import { handler as getTransactionsQueryHandler } from './handlers/get-transactions-query.js';
import { handler as getEntityTransactionsHandler } from './handlers/get-entity-transactions.js';

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function buildEvent(req: IncomingMessage, body: string, params?: Record<string, string>): APIGatewayProxyEventV2 {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const qsp: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { qsp[k] = v; });

  return {
    version: '2.0',
    routeKey: `${req.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: req.headers as Record<string, string>,
    queryStringParameters: Object.keys(qsp).length > 0 ? qsp : undefined,
    pathParameters: params,
    body,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: req.method ?? 'GET',
        path: url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: req.headers['user-agent'] ?? '',
      },
      requestId: crypto.randomUUID(),
      routeKey: `${req.method} ${url.pathname}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    stageVariables: undefined,
  } as APIGatewayProxyEventV2;
}

function invoke(handler: APIGatewayProxyHandlerV2, req: IncomingMessage, body: string, params?: Record<string, string>): Promise<APIGatewayProxyResultV2> {
  return handler(buildEvent(req, body, params), {} as never, () => {}) as Promise<APIGatewayProxyResultV2>;
}

async function route(method: string, path: string, req: IncomingMessage, body: string): Promise<APIGatewayProxyResultV2> {
  // Static routes first (before parameterized /:id)
  if (method === 'GET' && path === '/v1/health') return invoke(healthHandler, req, body);
  if (method === 'POST' && path === '/v1/objects') return invoke(upsertHandler, req, body);
  if (method === 'POST' && path === '/v1/objects/bulk') return invoke(bulkUpsertHandler, req, body);
  if (method === 'GET' && path === '/v1/objects/stats') return invoke(getStatsHandler, req, body);
  if (method === 'GET' && path === '/v1/objects/search') return invoke(searchObjectsHandler, req, body);
  if (method === 'GET' && path === '/v1/objects/changes') return invoke(getChangesHandler, req, body);
  if (method === 'GET' && path === '/v1/objects/txns') return invoke(getTransactionsQueryHandler, req, body);

  // Parameterized routes
  const entityTxnsMatch = path.match(/^\/v1\/objects\/([^/]+)\/txns$/);
  if (entityTxnsMatch) {
    const id = entityTxnsMatch[1];
    if (method === 'POST') return invoke(recordTxnHandler, req, body, { id });
    if (method === 'GET') return invoke(getEntityTransactionsHandler, req, body, { id });
  }

  const objectMatch = path.match(/^\/v1\/objects\/([^/]+)$/);
  if (method === 'GET' && objectMatch) {
    const id = objectMatch[1];
    return invoke(getObjectHandler, req, body, { id });
  }

  return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
}

const PORT = parseInt(process.env.PORT ?? '3002', 10);

async function start(): Promise<void> {
  const pool = getPool();
  await runMigrations(pool);

  const server = createServer(async (req, res) => {
    const body = await parseBody(req);
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const method = req.method ?? 'GET';

    let result: APIGatewayProxyResultV2;
    try {
      result = await route(method, url.pathname, req, body);
    } catch (err) {
      logger.error({ err }, 'Server error');
      result = { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
    }

    const r = result as { statusCode?: number; headers?: Record<string, string>; body?: string };
    res.writeHead(r?.statusCode ?? 200, r?.headers ?? {});
    res.end(r?.body ?? '');
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'ACP API server started');
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start API server');
  process.exit(1);
});
