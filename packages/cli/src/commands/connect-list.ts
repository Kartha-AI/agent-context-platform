import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../util/config.js';

export const connectListCommand = new Command('list')
  .description('List configured connectors')
  .option('-e, --env <name>', 'Target environment (local, staging, prod)')
  .action(async (opts) => {
    const config = resolveConfig(opts.env);
    console.log(chalk.dim(`→ ${config.envName}: ${config.apiUrl}`));
    const connectors = config.connectors ?? [];

    if (connectors.length === 0) {
      console.log('No connectors configured. Run "acp connect add csv" to add one.');
      return;
    }

    console.log('Configured connectors:');
    for (const c of connectors) {
      console.log(`  ${c.name} -> ${c.pipeline}`);
    }
  });
