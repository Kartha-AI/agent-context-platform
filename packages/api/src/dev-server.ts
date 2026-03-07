import { createServer, IncomingMessage, ServerResponse } from 'http';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { logger } from '@acp/core';
import { handler as upsertHandler } from './handlers/upsert-object.js';
import { handler as bulkUpsertHandler } from './handlers/bulk-upsert.js';
import { handler as getObjectHandler } from './handlers/get-object.js';
import { handler as recordTxnHandler } from './handlers/record-transaction.js';
import { handler as getChangesHandler } from './handlers/get-changes.js';
import { handler as healthHandler } from './handlers/health.js';

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

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = createServer(async (req, res) => {
  const body = await parseBody(req);
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  let result: APIGatewayProxyResultV2 | undefined;

  try {
    if (method === 'GET' && path === '/v1/health') {
      result = await healthHandler(buildEvent(req, body), {} as never, () => {}) as APIGatewayProxyResultV2;
    } else if (method === 'POST' && path === '/v1/objects') {
      result = await upsertHandler(buildEvent(req, body), {} as never, () => {}) as APIGatewayProxyResultV2;
    } else if (method === 'POST' && path === '/v1/objects/bulk') {
      result = await bulkUpsertHandler(buildEvent(req, body), {} as never, () => {}) as APIGatewayProxyResultV2;
    } else if (method === 'GET' && path === '/v1/objects/changes') {
      result = await getChangesHandler(buildEvent(req, body), {} as never, () => {}) as APIGatewayProxyResultV2;
    } else if (method === 'GET' && path.match(/^\/v1\/objects\/[^/]+$/)) {
      const id = path.split('/').pop()!;
      result = await getObjectHandler(buildEvent(req, body, { id }), {} as never, () => {}) as APIGatewayProxyResultV2;
    } else if (method === 'POST' && path.match(/^\/v1\/objects\/[^/]+\/txns$/)) {
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      result = await recordTxnHandler(buildEvent(req, body, { id }), {} as never, () => {}) as APIGatewayProxyResultV2;
    } else {
      result = { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (err) {
    logger.error({ err }, 'Dev server error');
    result = { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }

  const r = result as { statusCode?: number; headers?: Record<string, string>; body?: string };
  const statusCode = r?.statusCode ?? 200;
  const headers = r?.headers ?? {};
  res.writeHead(statusCode, headers);
  res.end(r?.body ?? '');
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Dev API server started');
});
