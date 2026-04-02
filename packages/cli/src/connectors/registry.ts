import type { Connector } from './types.js';
import { CsvConnector } from './csv/extractor.js';

const connectors: Record<string, Connector> = {
  csv: new CsvConnector(),
};

export function getConnector(type: string): Connector {
  const connector = connectors[type];
  if (!connector) {
    throw new Error(`Unknown connector type: ${type}. Available: ${Object.keys(connectors).join(', ')}`);
  }
  return connector;
}
