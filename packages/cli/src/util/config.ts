import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { parse as parseYaml } from 'yaml';

interface EnvironmentConfig {
  api_url: string;
  api_key: string;
}

export interface ResolvedConfig {
  apiUrl: string;
  apiKey: string;
  envName: string;
  connectors?: Array<{ name: string; pipeline: string }>;
  demo?: boolean;
  projectName?: string;
}

interface RawConfig {
  environments?: Record<string, EnvironmentConfig>;
  default?: string;
  platform?: EnvironmentConfig;
  // Legacy flat format
  api_url?: string;
  api_key?: string;
  // Shared fields
  project_name?: string;
  demo?: boolean;
  connectors?: Array<{ name: string; pipeline: string }>;
}

const CONFIG_FILENAME = 'acp.yaml';

export function findProjectRoot(from?: string): string | null {
  let dir = resolve(from ?? process.cwd());
  while (true) {
    if (existsSync(join(dir, CONFIG_FILENAME))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getProjectRoot(from?: string): string {
  const root = findProjectRoot(from);
  if (!root) {
    throw new Error(`No ${CONFIG_FILENAME} found. Run 'acp init' to create a project.`);
  }
  return root;
}

function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName.trim()];
    if (envValue === undefined) {
      throw new Error(
        `Environment variable "${varName}" is referenced in acp.yaml but not set. ` +
        `Set it with: export ${varName}=<value>`
      );
    }
    return envValue;
  });
}

function readRawConfig(from?: string): RawConfig {
  const root = getProjectRoot(from);
  const raw = readFileSync(join(root, CONFIG_FILENAME), 'utf-8');
  return parseYaml(raw) as RawConfig;
}

export function resolveConfig(envFlag?: string, from?: string): ResolvedConfig {
  const raw = readRawConfig(from);

  let envName: string;
  let envConfig: EnvironmentConfig;

  if (raw.environments) {
    // New multi-environment format
    envName = envFlag
      || process.env.ACP_ENV
      || raw.default
      || Object.keys(raw.environments)[0];

    envConfig = raw.environments[envName];
    if (!envConfig) {
      throw new Error(
        `Environment "${envName}" not found in acp.yaml. ` +
        `Available: ${Object.keys(raw.environments).join(', ')}`
      );
    }
  } else if (raw.platform) {
    // Old "platform" key format
    envName = 'default';
    envConfig = raw.platform;
  } else if (raw.api_url) {
    // Legacy flat format
    envName = 'default';
    envConfig = { api_url: raw.api_url, api_key: raw.api_key ?? 'dev-key' };
  } else {
    throw new Error(
      'acp.yaml must have "environments", "platform", or "api_url" key'
    );
  }

  return {
    apiUrl: expandEnvVars(envConfig.api_url),
    apiKey: expandEnvVars(envConfig.api_key),
    envName,
    connectors: raw.connectors,
    demo: raw.demo,
    projectName: raw.project_name,
  };
}

// Backward-compatible wrapper
export function loadConfig(from?: string): ResolvedConfig & { api_url: string; api_key: string } {
  const config = resolveConfig(undefined, from);
  return { ...config, api_url: config.apiUrl, api_key: config.apiKey };
}
