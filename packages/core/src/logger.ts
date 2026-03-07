import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = pino.Logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
