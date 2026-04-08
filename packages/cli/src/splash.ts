import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LOGO = `
  ██████╗  ██████╗██████╗
 ██╔══██╗██╔════╝██╔══██╗
 ███████║██║     ██████╔╝
 ██╔══██║██║     ██╔═══╝
 ██║  ██║╚██████╗██║
 ╚═╝  ╚═╝ ╚═════╝╚═╝
`;

export function showSplash(): void {
  const purple = chalk.hex('#7F77DD');
  const teal = chalk.hex('#5DCAA5');
  const dim = chalk.gray;
  const bold = chalk.bold;
  const blue = chalk.hex('#85B7EB');

  console.log(purple(LOGO));
  console.log(dim('  Agent Context Platform'));
  console.log();
  console.log(
    `  ${dim('The agent is the easy part.')} ${bold('Context is the hard part.')}`
  );
  console.log();
  console.log(dim('  ─────────────────────────────────────────────────'));
  console.log();
  console.log(`  ${dim('version')}      ${teal(getVersion())}`);
  console.log(`  ${dim('platform')}     ${dim('Postgres + REST API + MCP Server')}`);
  console.log(`  ${dim('docs')}         ${blue('https://github.com/Kartha-AI/agent-context-platform')}`);
  console.log();
  console.log(dim('  ─────────────────────────────────────────────────'));
  console.log();
  console.log(`  ${chalk.yellow('commands:')}`);
  console.log();
  console.log(`    ${teal('acp init')}              create a new project or load demo data`);
  console.log(`    ${teal('acp connect sync')}      load data into the platform`);
  console.log(`    ${teal('acp ctx list')}           list loaded entities`);
  console.log(`    ${teal('acp ctx get')}            view an entity's full context profile`);
  console.log(`    ${teal('acp ctx search')}         search entities with filters`);
  console.log(`    ${teal('acp setup')}              configure Claude Desktop, Cursor, or Claude Code`);
  console.log();
  console.log(dim('  ─────────────────────────────────────────────────'));
  console.log();
  console.log(`  ${dim('quick start:')}`);
  console.log();
  console.log(`    ${dim('$')} ${chalk.white('acp init --demo ~/projects/acp-demo')}`);
  console.log(`    ${dim('$')} ${chalk.white('cd ~/projects/acp-demo && acp connect sync')}`);
  console.log(`    ${dim('$')} ${chalk.white('acp setup claude-desktop')}`);
  console.log();
  console.log(`  ${dim('then ask Claude:')}`);
  console.log(`    ${dim('"')}${chalk.white('Brief me on our riskiest customer accounts')}${dim('"')}`);
  console.log();
  console.log(dim('  © 2026 Kartha AI · https://kartha.ai'));
  console.log();
}

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // dist/splash.js → ../package.json
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}
