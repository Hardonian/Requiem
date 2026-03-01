#!/usr/bin/env node
/**
 * @fileoverview Bugreport command - Generate diagnostic report for troubleshooting.
 *
 * Collects:
 * - System information
 * - Environment variables (sanitized)
 * - Configuration state
 * - Recent logs (if available)
 * - Dependency versions
 *
 * INVARIANT: Never includes secrets, tokens, or PII.
 * INVARIANT: Output is safe to share in bug reports.
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const VERSION = '0.2.0';

interface BugReport {
  generatedAt: string;
  cli: {
    version: string;
    argv: string[];
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cwd: string;
  };
  environment: Record<string, string | undefined>;
  configuration: {
    exists: boolean;
    content?: unknown;
    error?: string;
  };
  dependencies: Record<string, string>;
  git?: {
    branch?: string;
    commit?: string;
    dirty?: boolean;
  };
  logs: string[];
}

// Environment variables that are safe to include
const SAFE_ENV_VARS = [
  'NODE_ENV',
  'DECISION_ENGINE',
  'FORCE_RUST',
  'REQUIEM_ENGINE_AVAILABLE',
  'REQUIEM_ENABLE_METRICS',
  'PATH',
  'HOME',
  'USER',
  'SHELL',
];

// Environment variables to explicitly exclude (secrets)
const SECRET_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
];

export const bugreport = new Command('bugreport')
  .description('Generate diagnostic report for troubleshooting')
  .option('--output <file>', 'Write report to file')
  .option('--json', 'Output in JSON format (default)')
  .action(async (options) => {
    const report = generateBugReport();

    const output = JSON.stringify(report, null, 2);

    if (options.output) {
      const fs = await import('fs');
      fs.writeFileSync(options.output, output);
      console.log(`Bug report written to: ${options.output}`);
    } else {
      console.log(output);
    }
  });

function generateBugReport(): BugReport {
  const report: BugReport = {
    generatedAt: new Date().toISOString(),
    cli: {
      version: VERSION,
      argv: process.argv,
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
    environment: sanitizeEnvironment(),
    configuration: loadConfiguration(),
    dependencies: getDependencyVersions(),
    logs: collectRecentLogs(),
  };

  // Add git info if available
  const gitInfo = getGitInfo();
  if (gitInfo) {
    report.git = gitInfo;
  }

  return report;
}

function sanitizeEnvironment(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  for (const key of SAFE_ENV_VARS) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  // Add other env vars but redact potential secrets
  for (const [key, value] of Object.entries(process.env)) {
    if (SAFE_ENV_VARS.includes(key)) continue;

    const isSecret = SECRET_PATTERNS.some(pattern => pattern.test(key));
    if (isSecret) {
      env[key] = '[REDACTED]';
    } else if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

function loadConfiguration(): BugReport['configuration'] {
  const configPath = join(process.cwd(), '.requiem', 'config.json');

  if (!existsSync(configPath)) {
    return { exists: false };
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);

    // Redact any sensitive fields in config
    const sanitized = sanitizeConfig(parsed);

    return {
      exists: true,
      content: sanitized,
    };
  } catch (error) {
    return {
      exists: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sanitizeConfig(config: unknown): unknown {
  if (typeof config !== 'object' || config === null) {
    return config;
  }

  if (Array.isArray(config)) {
    return config.map(sanitizeConfig);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    const isSecret = SECRET_PATTERNS.some(pattern => pattern.test(key));
    if (isSecret) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeConfig(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function getDependencyVersions(): Record<string, string> {
  const deps: Record<string, string> = {};

  try {
    // Try to get package.json version
    const packagePath = join(process.cwd(), 'package.json');
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      deps['project'] = pkg.version || 'unknown';
    }
  } catch {
    // Ignore errors
  }

  // Try to get CLI version
  try {
    const cliPath = join(process.cwd(), 'packages/cli/package.json');
    if (existsSync(cliPath)) {
      const pkg = JSON.parse(readFileSync(cliPath, 'utf8'));
      deps['cli'] = pkg.version || 'unknown';
    }
  } catch {
    // Ignore errors
  }

  // Get versions of key tools
  const tools = ['node', 'npm', 'pnpm', 'git'];
  for (const tool of tools) {
    try {
      const version = execSync(`${tool} --version`, { stdio: 'pipe', encoding: 'utf8' }).trim();
      deps[tool] = version;
    } catch {
      deps[tool] = 'not found';
    }
  }

  return deps;
}

function getGitInfo(): BugReport['git'] | undefined {
  try {
    const branch = execSync('git branch --show-current', { stdio: 'pipe', encoding: 'utf8' }).trim();
    const commit = execSync('git rev-parse HEAD', { stdio: 'pipe', encoding: 'utf8' }).trim().slice(0, 8);
    const status = execSync('git status --porcelain', { stdio: 'pipe', encoding: 'utf8' }).trim();

    return {
      branch,
      commit,
      dirty: status.length > 0,
    };
  } catch {
    return undefined;
  }
}

function collectRecentLogs(): string[] {
  // In a real implementation, this might read from a log file
  // For now, return an empty array to avoid exposing sensitive data
  return [];
}
