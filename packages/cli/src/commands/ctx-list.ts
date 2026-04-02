import { Command } from 'commander';
import { loadConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';
import { formatStatsTable } from '../util/format.js';

export const ctxListCommand = new Command('list')
  .description('List entity counts by type')
  .action(async () => {
    const config = loadConfig();
    const client = new AcpApiClient(config.api_url, config.api_key);
    const { stats, total } = await client.getStats();
    console.log(formatStatsTable(stats, total, config.api_url));
  });
