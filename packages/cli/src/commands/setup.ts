import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

export function registerSetupCommand(program: Command): void {
  const setup = program
    .command('setup')
    .description('Configure AI agent clients to connect to ACP');

  setup
    .command('claude-desktop')
    .description('Auto-configure Claude Desktop to use ACP MCP server')
    .option('--db-url <url>', 'Database URL', 'postgresql://acp:localdev@localhost:5432/acp')
    .action(async (options) => {
      await setupClaudeDesktop(options);
    });

  setup
    .command('cursor')
    .description('Auto-configure Cursor to use ACP MCP server')
    .option('--db-url <url>', 'Database URL', 'postgresql://acp:localdev@localhost:5432/acp')
    .action(async (options) => {
      await setupCursor(options);
    });

  setup
    .command('claude-code')
    .description('Auto-configure Claude Code to use ACP MCP server')
    .option('--db-url <url>', 'Database URL', 'postgresql://acp:localdev@localhost:5432/acp')
    .action(async (options) => {
      await setupClaudeCode(options);
    });
}

// ─── Claude Desktop ─────────────────────────────────────────────

async function setupClaudeDesktop(options: { dbUrl: string }): Promise<void> {
  const teal = chalk.hex('#5DCAA5');
  const purple = chalk.hex('#7F77DD');
  const dim = chalk.gray;

  console.log();
  console.log(`  ${purple('Setting up Claude Desktop...')}`);
  console.log();

  const configPath = getClaudeDesktopConfigPath();
  if (!configPath) {
    console.log(chalk.red('  ✗ Could not determine Claude Desktop config path for this OS'));
    console.log(dim('    Supported: macOS, Windows, Linux'));
    return;
  }

  console.log(`  ${dim('Config file:')} ${configPath}`);

  const acpRepoPath = detectAcpRepoPath();
  if (!acpRepoPath) {
    console.log(chalk.red('  ✗ Could not find ACP repo. Run this from the ACP project directory'));
    console.log(dim('    or from a project created with `acp init`'));
    return;
  }

  const mcpServerPath = path.join(acpRepoPath, 'packages', 'mcp-server', 'dist', 'index.js');
  if (!fs.existsSync(mcpServerPath)) {
    console.log(chalk.red(`  ✗ MCP server not built. Run: pnpm run build`));
    console.log(dim(`    Expected: ${mcpServerPath}`));
    return;
  }

  const acpConfig = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      ACP_MCP_TRANSPORT: 'stdio',
      DATABASE_URL: options.dbUrl,
    },
  };

  let config: any = { mcpServers: {} };
  if (fs.existsSync(configPath)) {
    try {
      const existing = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(existing);
      if (!config.mcpServers) config.mcpServers = {};
      console.log(`  ${teal('✓')} Found existing config with ${Object.keys(config.mcpServers).length} MCP server(s)`);
    } catch {
      console.log(chalk.yellow('  ⚠ Existing config was invalid, creating new'));
      config = { mcpServers: {} };
    }
  } else {
    const configDir = path.dirname(configPath);
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`  ${teal('✓')} Creating new config`);
  }

  if (config.mcpServers.acp) {
    console.log(chalk.yellow('  ⚠ ACP is already configured in Claude Desktop'));
    console.log(dim('    Updating configuration...'));
  }

  config.mcpServers.acp = acpConfig;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`  ${teal('✓')} Added ACP MCP server to Claude Desktop config`);
  console.log();
  console.log(`  ${dim('MCP server:')} ${mcpServerPath}`);
  console.log(`  ${dim('Transport:')}  stdio`);
  console.log(`  ${dim('Database:')}   ${options.dbUrl}`);
  console.log();
  console.log(dim('  ─────────────────────────────────────────────────'));
  console.log();
  console.log(`  ${chalk.yellow('Next steps:')}`);
  console.log();
  console.log(`    1. ${chalk.white('Restart Claude Desktop')} (Cmd+Q then reopen)`);
  console.log(`    2. Start a new conversation and try:`);
  console.log();
  console.log(`       ${dim('"')}${chalk.white('Brief me on our riskiest customer accounts')}${dim('"')}`);
  console.log();
  console.log(`       ${dim('"')}${chalk.white('Which invoices are overdue and who owes the most?')}${dim('"')}`);
  console.log();
  console.log(`       ${dim('"')}${chalk.white('Show me all customers with renewals in the next 60 days')}${dim('"')}`);
  console.log();
  console.log(`    3. For structured workflows, create a Claude Desktop Project`);
  console.log(`       and paste the contents of:`);
  console.log(`       ${teal('skills/quickstart/claude-project.md')}`);
  console.log();
}

// ─── Cursor ─────────────────────────────────────────────────────

async function setupCursor(options: { dbUrl: string }): Promise<void> {
  const teal = chalk.hex('#5DCAA5');

  console.log();
  console.log(`  Setting up Cursor...`);

  const acpRepoPath = detectAcpRepoPath();
  if (!acpRepoPath) {
    console.log(chalk.red('  ✗ Could not find ACP repo.'));
    return;
  }

  const mcpServerPath = path.join(acpRepoPath, 'packages', 'mcp-server', 'dist', 'index.js');

  const cursorDir = path.join(process.cwd(), '.cursor');
  fs.mkdirSync(cursorDir, { recursive: true });

  const configPath = path.join(cursorDir, 'mcp.json');
  let config: any = { mcpServers: {} };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      config = { mcpServers: {} };
    }
  }

  config.mcpServers.acp = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      ACP_MCP_TRANSPORT: 'stdio',
      DATABASE_URL: options.dbUrl,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`  ${teal('✓')} Written to ${configPath}`);
  console.log(`  Restart Cursor to connect.`);
  console.log();
}

// ─── Claude Code ────────────────────────────────────────────────

async function setupClaudeCode(options: { dbUrl: string }): Promise<void> {
  const teal = chalk.hex('#5DCAA5');

  console.log();
  console.log(`  Setting up Claude Code...`);

  const acpRepoPath = detectAcpRepoPath();
  if (!acpRepoPath) {
    console.log(chalk.red('  ✗ Could not find ACP repo.'));
    return;
  }

  const mcpServerPath = path.join(acpRepoPath, 'packages', 'mcp-server', 'dist', 'index.js');

  const configPath = path.join(process.cwd(), '.mcp.json');
  let config: any = { mcpServers: {} };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      config = { mcpServers: {} };
    }
  }

  config.mcpServers.acp = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      ACP_MCP_TRANSPORT: 'stdio',
      DATABASE_URL: options.dbUrl,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`  ${teal('✓')} Written to ${configPath}`);
  console.log(`  Claude Code will detect the .mcp.json automatically.`);
  console.log();
}

// ─── Helpers ────────────────────────────────────────────────────

function getClaudeDesktopConfigPath(): string | null {
  const platform = os.platform();
  const home = os.homedir();

  switch (platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return path.join(home, '.config', 'claude', 'claude_desktop_config.json');
    default:
      return null;
  }
}

function detectAcpRepoPath(): string | null {
  // 1. Walk up from cwd
  const fromCwd = walkUpForRepo(process.cwd());
  if (fromCwd) return fromCwd;

  // 2. Walk up from this script's location (handles `pnpm link --global` case
  //    where the user runs `acp setup` from outside the repo)
  try {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    // Resolve symlinks so pnpm-linked global bin points to the real repo
    const realScriptDir = fs.realpathSync(scriptDir);
    const fromScript = walkUpForRepo(realScriptDir);
    if (fromScript) return fromScript;
  } catch {
    // ignore
  }

  // 3. Fallback: ACP_REPO_PATH env var
  if (process.env.ACP_REPO_PATH && fs.existsSync(process.env.ACP_REPO_PATH)) {
    return process.env.ACP_REPO_PATH;
  }

  return null;
}

function walkUpForRepo(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (
      fs.existsSync(path.join(dir, 'packages', 'mcp-server')) &&
      fs.existsSync(path.join(dir, 'docker-compose.yml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
