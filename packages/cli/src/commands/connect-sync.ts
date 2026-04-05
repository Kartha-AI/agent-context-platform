import { Command } from 'commander';
import { join } from 'path';
import chalk from 'chalk';
import { resolveConfig, getProjectRoot } from '../util/config.js';
import { loadProjectTemplates } from '../util/template-loader.js';
import { validateContext } from '../util/validator.js';
import { AcpApiClient } from '../util/api-client.js';
import { getConnector } from '../connectors/registry.js';
import { parsePipelineYaml } from '../pipelines/parser.js';
import { mapRecord } from '../pipelines/mapper.js';
import type { UpsertBody } from '../util/api-client.js';

const BATCH_SIZE = 100;

export const connectSyncCommand = new Command('sync')
  .description('Validate and load data into the platform')
  .option('-e, --env <name>', 'Target environment (local, staging, prod)')
  .option('--dry-run', 'Validate and map data but do not POST to the platform')
  .action(async (opts) => {
    const root = getProjectRoot();
    const config = resolveConfig(opts.env);
    console.log(chalk.dim(`→ ${config.envName}: ${config.apiUrl}`));
    const client = new AcpApiClient(config.apiUrl, config.apiKey);
    const templates = loadProjectTemplates(join(root, 'contexts'));

    const connectors = config.connectors ?? [];
    if (connectors.length === 0) {
      console.error('No connectors configured. Run "acp connect add csv" first.');
      process.exit(1);
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalValidated = 0;

    for (const conn of connectors) {
      console.log(`\nSyncing: ${conn.name}`);
      const pipeline = parsePipelineYaml(join(root, conn.pipeline));
      const connector = getConnector(pipeline.source.type);
      const template = templates.find((t) => t.subtype === pipeline.target_context);

      // Extract
      const records = await connector.extract(join(root, pipeline.source.file));
      console.log(`  Extracted ${records.length} records from ${pipeline.source.file}`);

      // Map and validate
      const valid: UpsertBody[] = [];
      let validationErrors = 0;

      for (let i = 0; i < records.length; i++) {
        const mapped = mapRecord(records[i], pipeline, pipeline.source.type);
        if (!mapped) {
          console.error(`  Row ${i + 1}: missing identity fields, skipped`);
          validationErrors++;
          continue;
        }

        if (template) {
          const result = validateContext(mapped.context as Record<string, unknown>, template);
          if (!result.valid) {
            console.error(`  Row ${i + 1} (${mapped.canonicalName}): ${result.errors?.join('; ')}`);
            validationErrors++;
            continue;
          }
        }

        valid.push(mapped);
      }

      if (validationErrors > 0) {
        console.log(`  ${validationErrors} validation error(s)`);
      }

      totalValidated += valid.length;

      if (opts.dryRun) {
        console.log(`  ${valid.length} records validated`);
        continue;
      }

      // Batch upload
      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = valid.slice(i, i + BATCH_SIZE);
        const { results, errors } = await client.bulkUpsert(batch);
        const created = (results as Array<{ status: string }>).filter((r) => r.status === 'created').length;
        const updated = (results as Array<{ status: string }>).filter((r) => r.status === 'updated').length;
        totalCreated += created;
        totalUpdated += updated;
        totalErrors += (errors as unknown[]).length;

        if ((errors as unknown[]).length > 0) {
          for (const e of errors as Array<{ index: number; error: string }>) {
            console.error(`  Batch error at index ${e.index}: ${e.error}`);
          }
        }
      }

      console.log(`  Loaded ${valid.length} records`);
    }

    if (opts.dryRun) {
      console.log(chalk.green(`\nDry run complete. ${totalValidated} entities validated.`));
      console.log(chalk.dim('No data was sent to the platform.'));
    } else {
      console.log(`\nSync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors`);
    }
  });
