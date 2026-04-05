import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../util/config.js';
import { AcpApiClient } from '../util/api-client.js';
import { formatEntityProfile } from '../util/format.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ctxGetCommand = new Command('get')
  .argument('<type>', 'Entity type (e.g., customer)')
  .argument('<nameOrId>', 'Entity name or UUID')
  .description('Get full context profile for an entity')
  .option('-e, --env <name>', 'Target environment (local, staging, prod)')
  .action(async (type: string, nameOrId: string, opts) => {
    const config = resolveConfig(opts.env);
    console.log(chalk.dim(`→ ${config.envName}: ${config.apiUrl}`));
    const client = new AcpApiClient(config.apiUrl, config.apiKey);

    let entity: Record<string, unknown>;

    if (UUID_RE.test(nameOrId)) {
      entity = await client.getObject(nameOrId) as Record<string, unknown>;
    } else {
      const { results } = await client.searchObjects({ type, query: nameOrId, limit: 1 });
      if (results.length === 0) {
        console.error(`No ${type} found matching "${nameOrId}"`);
        process.exit(1);
      }
      const match = results[0] as Record<string, unknown>;
      entity = await client.getObject(match.objectId as string) as Record<string, unknown>;
    }

    console.log(formatEntityProfile(entity));
  });
