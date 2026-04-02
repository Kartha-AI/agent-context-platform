import { Command } from 'commander';
import { loadConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';

export const txnAddCommand = new Command('add')
  .requiredOption('--object-id <id>', 'Entity ID')
  .requiredOption('--type <type>', 'Transaction type')
  .option('--context <json>', 'Transaction context (JSON)', '{}')
  .option('--actors <json>', 'Actors involved (JSON)')
  .option('--measures <json>', 'Measures (JSON)')
  .description('Record a transaction for an entity')
  .action(async (opts) => {
    const config = loadConfig();
    const client = new AcpApiClient(config.api_url, config.api_key);

    const result = await client.recordTransaction(opts.objectId, {
      transactionType: opts.type,
      context: JSON.parse(opts.context),
      actors: opts.actors ? JSON.parse(opts.actors) : undefined,
      measures: opts.measures ? JSON.parse(opts.measures) : undefined,
    });

    console.log(`Transaction recorded: ${result.transactionId}`);
  });
