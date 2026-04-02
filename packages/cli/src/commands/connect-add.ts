import { Command } from 'commander';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml, stringify as toYaml } from 'yaml';
import { getProjectRoot, loadConfig } from '../util/config.js';
import { loadProjectTemplates } from '../util/template-loader.js';
import { CsvConnector } from '../connectors/csv/extractor.js';
import { autoMap } from '../pipelines/auto-mapper.js';

export const connectAddCommand = new Command('add')
  .argument('<type>', 'Connector type (csv)')
  .description('Configure a data source and generate mapping')
  .action(async (type: string) => {
    if (type !== 'csv') {
      console.error(`Unsupported connector type: ${type}. Available: csv`);
      process.exit(1);
    }

    const root = getProjectRoot();
    const { default: inquirer } = await import('inquirer');

    // List data files
    const dataDir = join(root, 'data');
    const dataFiles = readdirSync(dataDir).filter((f) =>
      f.endsWith('.csv') || f.endsWith('.json') || f.endsWith('.jsonl'),
    );

    if (dataFiles.length === 0) {
      console.error('No data files found in data/. Add CSV, JSON, or JSONL files first.');
      process.exit(1);
    }

    const { file } = await inquirer.prompt([{
      type: 'list',
      name: 'file',
      message: 'Select data file:',
      choices: dataFiles,
    }]);

    // List context types
    const templates = loadProjectTemplates(join(root, 'contexts'));
    if (templates.length === 0) {
      console.error('No context types defined. Run "acp ctx define" first.');
      process.exit(1);
    }

    const { targetContext } = await inquirer.prompt([{
      type: 'list',
      name: 'targetContext',
      message: 'Map to which context type?',
      choices: templates.map((t) => ({ name: `${t.subtype} - ${t.description}`, value: t.subtype })),
    }]);

    const template = templates.find((t) => t.subtype === targetContext)!;

    // Read first row to get columns
    const connector = new CsvConnector();
    const records = await connector.extract(join(dataDir, file));
    if (records.length === 0) {
      console.error('Data file is empty.');
      process.exit(1);
    }
    const columns = Object.keys(records[0]);

    // Ask for identity fields
    const { sourceRefField } = await inquirer.prompt([{
      type: 'list',
      name: 'sourceRefField',
      message: 'Which column is the unique ID?',
      choices: columns,
    }]);

    const { canonicalNameField } = await inquirer.prompt([{
      type: 'list',
      name: 'canonicalNameField',
      message: 'Which column is the display name?',
      choices: columns,
    }]);

    // Auto-map remaining columns
    const { mapping, unmapped } = autoMap(columns, template);

    const pipelineConfig = {
      source: { type: 'csv', file: `data/${file}` },
      target_context: targetContext,
      identity: {
        source_ref_field: sourceRefField,
        canonical_name_field: canonicalNameField,
      },
      mapping,
    };

    const pipelineName = `${basename(file, '.csv')}-csv`;
    const pipelinePath = join(root, 'pipelines', `${pipelineName}.yaml`);
    writeFileSync(pipelinePath, toYaml(pipelineConfig));

    // Update acp.yaml
    const configPath = join(root, 'acp.yaml');
    const config = parseYaml(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const connectors = (config.connectors ?? []) as Array<{ name: string; pipeline: string }>;
    connectors.push({ name: pipelineName, pipeline: `pipelines/${pipelineName}.yaml` });
    config.connectors = connectors;
    writeFileSync(configPath, toYaml(config));

    console.log(`\nPipeline created: pipelines/${pipelineName}.yaml`);
    if (unmapped.length > 0) {
      console.log(`\nUnmapped columns: ${unmapped.join(', ')}`);
      console.log('Edit the pipeline YAML to map them manually.');
    }
    console.log(`\nRun "acp connect sync" to load data.`);
  });
