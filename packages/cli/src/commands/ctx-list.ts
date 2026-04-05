import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';
import { formatStatsTable } from '../util/format.js';

export const ctxListCommand = new Command('list')
  .description('List entity counts by type')
  .option('-e, --env <name>', 'Target environment (local, staging, prod)')
  .action(async (opts) => {
    const config = resolveConfig(opts.env);
    console.log(chalk.dim(`→ ${config.envName}: ${config.apiUrl}`));
    const client = new AcpApiClient(config.apiUrl, config.apiKey);
    const { stats, total } = await client.getStats();
    console.log(formatStatsTable(stats, total, config.apiUrl));
  });
