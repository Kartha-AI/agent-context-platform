import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';
import { formatTransactions } from '../util/format.js';

export const txnListCommand = new Command('list')
  .option('--object-id <id>', 'Filter by entity ID')
  .option('--types <types>', 'Filter by transaction type(s), comma-separated')
  .option('--since <timestamp>', 'After this ISO timestamp')
  .option('--until <timestamp>', 'Before this ISO timestamp')
  .option('--limit <n>', 'Max results', '20')
  .option('-e, --env <name>', 'Target environment (local, staging, prod)')
  .description('List transactions')
  .action(async (opts) => {
    const config = resolveConfig(opts.env);
    console.log(chalk.dim(`→ ${config.envName}: ${config.apiUrl}`));
    const client = new AcpApiClient(config.apiUrl, config.apiKey);

    const { transactions } = await client.getTransactions({
      objectId: opts.objectId,
      types: opts.types?.split(','),
      since: opts.since,
      until: opts.until,
      limit: parseInt(opts.limit, 10),
    });

    if ((transactions as unknown[]).length === 0) {
      console.log('No transactions found.');
      return;
    }

    console.log(formatTransactions(transactions as Record<string, unknown>[]));
  });
