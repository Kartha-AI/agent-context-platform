import { logger } from '@acp/core';

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3001/mcp';

let sessionId: string | null = null;

async function mcpRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  const sid = response.headers.get('mcp-session-id');
  if (sid) sessionId = sid;

  const text = await response.text();
  // Handle SSE responses — extract JSON from event stream
  if (text.startsWith('event:')) {
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
    return dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
  }
  return JSON.parse(text);
}

async function initialize(): Promise<void> {
  await mcpRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'acp-test', version: '0.1.0' },
  });
  await mcpRequest('notifications/initialized');
}

async function callTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
  return mcpRequest('tools/call', { name: tool, arguments: args });
}

async function main(): Promise<void> {
  logger.info('Testing MCP tools...');

  logger.info('Initializing MCP session...');
  await initialize();
  logger.info('Session initialized');

  logger.info('--- search_entities ---');
  const searchResult = await callTool('search_entities', { type: 'customer', limit: 5 });
  logger.info({ result: searchResult }, 'search_entities result');

  logger.info('--- get_entity by name ---');
  const getResult = await callTool('get_entity', { type: 'customer', name: 'Acme' });
  logger.info({ result: getResult }, 'get_entity result');

  logger.info('--- get_context_changes ---');
  const changesResult = await callTool('get_context_changes', {
    since: new Date(Date.now() - 86400000).toISOString(),
  });
  logger.info({ result: changesResult }, 'get_context_changes result');

  logger.info('MCP tool tests complete');
}

main().catch((err) => {
  logger.error({ err }, 'MCP test failed');
  process.exit(1);
});
