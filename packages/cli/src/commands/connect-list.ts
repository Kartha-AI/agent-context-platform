import { Command } from 'commander';
import { loadConfig } from '../util/config.js';

export const connectListCommand = new Command('list')
  .description('List configured connectors')
  .action(async () => {
    const config = loadConfig();
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
