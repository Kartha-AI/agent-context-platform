import { createServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger, getPool } from '@acp/core';
import { createMcpServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main(): Promise<void> {
  const pool = getPool();
  await pool.query('SELECT 1');
  logger.info('Database connection verified');

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    if (url.pathname === '/mcp' || url.pathname === '/') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }

      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'MCP server started');
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    for (const transport of sessions.values()) {
      await transport.close().catch(() => {});
    }
    httpServer.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start MCP server');
  process.exit(1);
});
