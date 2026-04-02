import { readFileSync } from 'fs';
import { parse as csvParse } from 'csv-parse/sync';
import type { RawRecord, Connector } from '../types.js';

export class CsvConnector implements Connector {
  type = 'csv';

  async extract(filePath: string): Promise<RawRecord[]> {
    const content = readFileSync(filePath, 'utf-8');

    if (filePath.endsWith('.json')) {
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [data];
    }

    if (filePath.endsWith('.jsonl')) {
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    }

    // CSV
    return csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as RawRecord[];
  }
}
