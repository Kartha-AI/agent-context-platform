import pino from 'pino';

const isStdio = process.env.ACP_MCP_TRANSPORT === 'stdio';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}, isStdio ? pino.destination(2) : undefined);

export type Logger = pino.Logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
