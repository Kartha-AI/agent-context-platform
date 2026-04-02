import { Command } from 'commander';
import { loadConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';

export const ctxSearchCommand = new Command('search')
  .option('--type <type>', 'Filter by entity type')
  .option('--query <text>', 'Text search on name')
  .option('--filter <json>', 'JSONB filter (JSON string)')
  .option('--limit <n>', 'Max results', '10')
  .description('Search for entities')
  .action(async (opts) => {
    const config = loadConfig();
    const client = new AcpApiClient(config.api_url, config.api_key);

    const filters = opts.filter ? JSON.parse(opts.filter) : undefined;
    const { results } = await client.searchObjects({
      type: opts.type,
      query: opts.query,
      filters,
      limit: parseInt(opts.limit, 10),
    });

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    for (const r of results as Record<string, unknown>[]) {
      const id = (r.objectId as string).slice(0, 8);
      const name = r.canonicalName as string;
      const subtype = r.subtype as string;
      console.log(`  ${id}...  ${subtype.padEnd(15)} ${name}`);
    }
    console.log(`\n${results.length} result(s)`);
  });
