import { Command } from 'commander';
import { loadConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';
import { formatTransactions } from '../util/format.js';

export const txnListCommand = new Command('list')
  .option('--object-id <id>', 'Filter by entity ID')
  .option('--types <types>', 'Filter by transaction type(s), comma-separated')
  .option('--since <timestamp>', 'After this ISO timestamp')
  .option('--until <timestamp>', 'Before this ISO timestamp')
  .option('--limit <n>', 'Max results', '20')
  .description('List transactions')
  .action(async (opts) => {
    const config = loadConfig();
    const client = new AcpApiClient(config.api_url, config.api_key);

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
