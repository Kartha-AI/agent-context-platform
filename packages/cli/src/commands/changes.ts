import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';
import { formatChanges } from '../util/format.js';

export const changesCommand = new Command('changes')
  .requiredOption('--since <timestamp>', 'ISO timestamp')
  .option('--types <types>', 'Filter by subtype(s), comma-separated')
  .option('--limit <n>', 'Max results', '50')
  .option('-e, --env <name>', 'Target environment (local, staging, prod)')
  .description('Show what changed since a timestamp')
  .action(async (opts) => {
    const config = resolveConfig(opts.env);
    console.log(chalk.dim(`→ ${config.envName}: ${config.apiUrl}`));
    const client = new AcpApiClient(config.apiUrl, config.apiKey);

    const { changes, cursor } = await client.getChanges({
      since: opts.since,
      types: opts.types?.split(','),
      limit: parseInt(opts.limit, 10),
    });

    if ((changes as unknown[]).length === 0) {
      console.log('No changes since that time.');
      return;
    }

    console.log(`Changes since ${opts.since}:`);
    console.log(formatChanges(changes as Record<string, unknown>[], cursor));
  });
