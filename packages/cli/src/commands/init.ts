import { Command } from 'commander';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stringify as toYaml } from 'yaml';
import { listStandardTemplates } from '../util/template-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getStandardTemplatesDir(): string {
  return join(__dirname, '..', '..', 'standard-templates');
}

export const initCommand = new Command('init')
  .argument('<path>', 'Project directory to create')
  .option('--demo', 'Create a demo project with sample data')
  .description('Initialize an ACP project')
  .action(async (targetPath: string, opts: { demo?: boolean }) => {
    const projectDir = resolve(targetPath);

    if (existsSync(join(projectDir, 'acp.yaml'))) {
      console.error(`Project already exists at ${projectDir}`);
      process.exit(1);
    }

    const templates = listStandardTemplates();
    let selectedSubtypes: string[];

    if (opts.demo) {
      selectedSubtypes = ['customer', 'contact', 'invoice', 'vendor'];
    } else {
      // Dynamic import for inquirer (ESM)
      const { default: inquirer } = await import('inquirer');
      const choices = templates.map((t) => ({
        name: `${t.subtype} - ${t.description}`,
        value: t.subtype,
        checked: ['customer', 'contact'].includes(t.subtype),
      }));

      const { selected } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selected',
        message: 'Select context types for your project:',
        choices,
      }]);
      selectedSubtypes = selected as string[];
    }

    // Create directories
    mkdirSync(join(projectDir, 'contexts'), { recursive: true });
    mkdirSync(join(projectDir, 'pipelines'), { recursive: true });
    mkdirSync(join(projectDir, 'data'), { recursive: true });

    // Copy selected templates
    const stdDir = getStandardTemplatesDir();
    for (const subtype of selectedSubtypes) {
      const template = templates.find((t) => t.subtype === subtype);
      if (!template) continue;

      // Find the source file
      const candidates = [
        join(stdDir, 'crm', `${subtype}.yaml`),
        join(stdDir, 'finance', `${subtype}.yaml`),
        join(stdDir, 'legal', `${subtype}.yaml`),
        join(stdDir, 'logistics', `${subtype}.yaml`),
        join(stdDir, 'catalog', `${subtype}.yaml`),
        join(stdDir, 'hr', `${subtype}.yaml`),
      ];
      const src = candidates.find(existsSync);
      if (src) {
        copyFileSync(src, join(projectDir, 'contexts', `${subtype}.yaml`));
      }
    }

    // Copy demo data if --demo
    if (opts.demo) {
      const demoDir = join(__dirname, '..', '..', 'src', 'demo');
      const demoDist = join(__dirname, '..', 'demo');
      const actualDemoDir = existsSync(join(demoDir, 'data')) ? demoDir : demoDist;

      if (existsSync(join(actualDemoDir, 'data'))) {
        const { readdirSync } = await import('fs');
        for (const f of readdirSync(join(actualDemoDir, 'data'))) {
          copyFileSync(join(actualDemoDir, 'data', f), join(projectDir, 'data', f));
        }
        if (existsSync(join(actualDemoDir, 'pipelines'))) {
          for (const f of readdirSync(join(actualDemoDir, 'pipelines'))) {
            copyFileSync(join(actualDemoDir, 'pipelines', f), join(projectDir, 'pipelines', f));
          }
        }
      }
    }

    // Write acp.yaml
    const config: Record<string, unknown> = {
      api_url: 'http://localhost:3002',
      api_key: 'dev-key',
      project_name: projectDir.split('/').pop(),
    };
    if (opts.demo) {
      config.demo = true;
      config.connectors = [
        { name: 'customers-csv', pipeline: 'pipelines/customers-csv.yaml' },
        { name: 'contacts-csv', pipeline: 'pipelines/contacts-csv.yaml' },
        { name: 'invoices-csv', pipeline: 'pipelines/invoices-csv.yaml' },
        { name: 'vendors-csv', pipeline: 'pipelines/vendors-csv.yaml' },
      ];
    }
    writeFileSync(join(projectDir, 'acp.yaml'), toYaml(config));

    console.log(`\nProject created at ${projectDir}`);
    console.log(`  Context types: ${selectedSubtypes.join(', ')}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${targetPath}`);
    if (opts.demo) {
      console.log(`  acp connect sync     # Load demo data`);
    } else {
      console.log(`  cp your-data.csv data/`);
      console.log(`  acp connect add csv  # Configure data mapping`);
      console.log(`  acp connect sync     # Load data`);
    }
  });
