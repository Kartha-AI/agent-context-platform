import { Command } from 'commander';
import { copyFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stringify as toYaml } from 'yaml';
import { getProjectRoot } from '../util/config.js';
import { listStandardTemplates } from '../util/template-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getStandardTemplatesDir(): string {
  return join(__dirname, '..', '..', 'standard-templates');
}

export const ctxDefineCommand = new Command('define')
  .argument('[type]', 'Context type name (e.g., customer, fleet-vehicle)')
  .description('Add a context type definition to the project')
  .action(async (type?: string) => {
    const root = getProjectRoot();
    const contextsDir = join(root, 'contexts');
    const templates = listStandardTemplates();
    const stdDir = getStandardTemplatesDir();

    if (!type) {
      // Show browsable list
      const { default: inquirer } = await import('inquirer');
      const choices = templates.map((t) => ({
        name: `${t.subtype} - ${t.description}`,
        value: t.subtype,
      }));
      const { selected } = await inquirer.prompt([{
        type: 'list',
        name: 'selected',
        message: 'Select a standard context type:',
        choices: [...choices, { name: '(custom)', value: '__custom__' }],
      }]);
      type = selected as string;
    }

    if (type === '__custom__') {
      const { default: inquirer } = await import('inquirer');
      const { name } = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Context type name (e.g., fleet-vehicle):',
      }]);
      type = name;
    }

    // Check if it's a standard template
    const standard = templates.find((t) => t.subtype === type);
    if (standard) {
      const candidates = [
        join(stdDir, 'crm', `${type}.yaml`),
        join(stdDir, 'finance', `${type}.yaml`),
        join(stdDir, 'legal', `${type}.yaml`),
        join(stdDir, 'logistics', `${type}.yaml`),
        join(stdDir, 'catalog', `${type}.yaml`),
        join(stdDir, 'hr', `${type}.yaml`),
      ];
      const src = candidates.find(existsSync);
      if (src) {
        copyFileSync(src, join(contextsDir, `${type}.yaml`));
        console.log(`Copied standard template: ${type}`);
        return;
      }
    }

    // Custom type: create minimal template
    const custom = {
      template_id: `custom-${type}`,
      type: 'entity',
      subtype: type,
      version: '1.0',
      description: `Custom ${type} entity`,
      schema: {
        attributes: {
          name: { type: 'string', required: true, description: `${type} name` },
        },
        measures: {},
        actors: {},
        temporals: {},
      },
      transaction_types: [],
    };
    writeFileSync(join(contextsDir, `${type}.yaml`), toYaml(custom));
    console.log(`Created custom template: contexts/${type}.yaml`);
    console.log(`Edit it to add fields for your ${type} entities.`);
  });
