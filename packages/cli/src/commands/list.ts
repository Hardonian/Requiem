#!/usr/bin/env node
/**
 * @fileoverview List command - List runs, artifacts, policies, and providers.
 *
 * Supports:
 * - runs: List execution runs with filters
 * - artifacts: List stored artifacts
 * - policies: List available policies
 * - providers: List configured providers
 *
 * Output formats: --json, --jsonl, --table
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';

const VERSION = '0.2.0';

interface RunSummary {
  id: string;
  fingerprint: string;
  tool: string;
  timestamp: string;
  status: 'success' | 'failure' | 'pending';
  duration?: number;
}

interface ArtifactSummary {
  id: string;
  type: string;
  size: number;
  checksum: string;
  createdAt: string;
}

interface PolicySummary {
  name: string;
  version: string;
  type: 'allow' | 'deny';
  rules: number;
}

interface ProviderSummary {
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  models?: string[];
}

function getRunsDir(): string {
  return join(process.cwd(), '.requiem', 'runs');
}

function getArtifactsDir(): string {
  return join(process.cwd(), '.requiem', 'artifacts');
}

function getPoliciesDir(): string {
  return join(process.cwd(), '.requiem', 'policies');
}

function listRuns(options: {
  limit?: number;
  status?: string;
  tool?: string;
  since?: string;
}): RunSummary[] {
  const runsDir = getRunsDir();

  if (!existsSync(runsDir)) {
    return [];
  }

  const files = readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));

  const runs: RunSummary[] = [];

  for (const file of files.slice(0, options.limit || 100)) {
    try {
      const content = readFileSync(join(runsDir, file), 'utf-8');
      const run = JSON.parse(content);

      // Apply filters
      if (options.status && run.status !== options.status) continue;
      if (options.tool && run.tool !== options.tool) continue;
      if (options.since) {
        const sinceDate = new Date(options.since);
        const runDate = new Date(run.timestamp || run.createdAt);
        if (runDate < sinceDate) continue;
      }

      runs.push({
        id: run.id || file.replace('.json', ''),
        fingerprint: run.fingerprint || run.resultDigest || 'N/A',
        tool: run.tool || run.command || 'unknown',
        timestamp: run.timestamp || run.createdAt || new Date().toISOString(),
        status: run.status || (run.error ? 'failure' : 'success'),
        duration: run.duration || run.executionTime,
      });
    } catch {
      // Skip invalid files
    }
  }

  return runs;
}

function listArtifacts(options: {
  limit?: number;
  type?: string;
}): ArtifactSummary[] {
  const artifactsDir = getArtifactsDir();

  if (!existsSync(artifactsDir)) {
    return [];
  }

  const files = readdirSync(artifactsDir)
    .filter(f => !f.startsWith('.'))
    .sort((a, b) => b.localeCompare(a));

  const artifacts: ArtifactSummary[] = [];

  for (const file of files.slice(0, options.limit || 100)) {
    try {
      const manifestPath = join(artifactsDir, file, 'manifest.json');
      if (!existsSync(manifestPath)) continue;

      const content = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      if (options.type && manifest.type !== options.type) continue;

      artifacts.push({
        id: manifest.id || file,
        type: manifest.type || 'unknown',
        size: manifest.size || 0,
        checksum: manifest.checksum || manifest.hash || 'N/A',
        createdAt: manifest.createdAt || manifest.timestamp || new Date().toISOString(),
      });
    } catch {
      // Skip invalid entries
    }
  }

  return artifacts;
}

function listPolicies(options: { limit?: number }): PolicySummary[] {
  const policiesDir = getPoliciesDir();

  // Try to get from config or contracts
  const policies: PolicySummary[] = [
    {
      name: 'default',
      version: '1.0.0',
      type: 'deny',
      rules: 5,
    },
    {
      name: 'migration',
      version: '1.0.0',
      type: 'allow',
      rules: 3,
    },
  ];

  if (existsSync(policiesDir)) {
    const files = readdirSync(policiesDir).filter(f => f.endsWith('.json'));
    for (const file of files.slice(0, options.limit || 100)) {
      try {
        const content = readFileSync(join(policiesDir, file), 'utf-8');
        const policy = JSON.parse(content);
        policies.push({
          name: policy.name || file.replace('.json', ''),
          version: policy.version || '1.0.0',
          type: policy.type || 'deny',
          rules: policy.rules?.length || 0,
        });
      } catch {
        // Skip invalid
      }
    }
  }

  return policies;
}

function listProviders(options: { limit?: number }): ProviderSummary[] {
  // Default providers based on environment
  const providers: ProviderSummary[] = [
    {
      name: 'openai',
      type: 'openai',
      status: process.env.OPENAI_API_KEY ? 'active' : 'inactive',
      models: ['gpt-4', 'gpt-3.5-turbo'],
    },
    {
      name: 'anthropic',
      type: 'anthropic',
      status: process.env.ANTHROPIC_API_KEY ? 'active' : 'inactive',
      models: ['claude-3-opus', 'claude-3-sonnet'],
    },
  ];

  return providers.slice(0, options.limit || 100);
}

export const list = new Command('list')
  .description('List runs, artifacts, policies, or providers')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--limit <n>', 'Limit number of results', '20')
  .option('--status <status>', 'Filter by run status')
  .option('--tool <name>', 'Filter by tool name')
  .option('--type <type>', 'Filter by type (for artifacts)')
  .option('--since <time>', 'Filter by timestamp (ISO 8601 or relative)')
  .action(async (options) => {
    // Default to showing runs
    const runs = listRuns({
      limit: parseInt(options.limit, 10),
      status: options.status,
      tool: options.tool,
      since: options.since,
    });

    if (options.json || options.format === 'json') {
      console.log(JSON.stringify({ runs }, null, 2));
    } else if (options.jsonl || options.format === 'jsonl') {
      for (const run of runs) {
        console.log(JSON.stringify(run));
      }
    } else if (options.format === 'table' || !options.format) {
      if (runs.length === 0) {
        console.log('No runs found.');
        return;
      }

      console.log('');
      console.log(`Found ${runs.length} runs:`);
      console.log('');
      console.log('ID'.padEnd(12) + 'TOOL'.padEnd(20) + 'STATUS'.padEnd(10) + 'DURATION' + 'TIMESTAMP');
      console.log('-'.repeat(70));

      for (const run of runs) {
        const statusIcon = run.status === 'success' ? '✓' : run.status === 'failure' ? '✗' : '?';
        const duration = run.duration ? `${run.duration}ms` : '-';
        const time = run.timestamp.split('T)[0] || run.timestamp.slice(0, 10);
        console.log(
          run.id.slice(0, 12).padEnd(12) +
          run.tool.slice(0, 19).padEnd(20) +
          `${statusIcon} ${run.status}`.padEnd(10) +
          duration.padEnd(8) +
          time
        );
      }
      console.log('');
    }
  });

// Subcommand: runs
list.command('runs')
  .description('List execution runs')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--limit <n>', 'Limit number of results', '20')
  .option('--status <status>', 'Filter by status: success, failure, pending')
  .option('--tool <name>', 'Filter by tool name')
  .option('--since <time>', 'Filter since timestamp')
  .action(async (options) => {
    const runs = listRuns({
      limit: parseInt(options.limit, 10),
      status: options.status,
      tool: options.tool,
      since: options.since,
    });

    outputList(runs, options, 'runs');
  });

// Subcommand: artifacts
list.command('artifacts')
  .description('List stored artifacts')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--limit <n>', 'Limit number of results', '20')
  .option('--type <type>', 'Filter by artifact type')
  .action(async (options) => {
    const artifacts = listArtifacts({
      limit: parseInt(options.limit, 10),
      type: options.type,
    });

    outputList(artifacts, options, 'artifacts');
  });

// Subcommand: policies
list.command('policies')
  .description('List available policies')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--limit <n>', 'Limit number of results', '20')
  .action(async (options) => {
    const policies = listPolicies({
      limit: parseInt(options.limit, 10),
    });

    outputList(policies, options, 'policies');
  });

// Subcommand: providers
list.command('providers')
  .description('List configured providers')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--limit <n>', 'Limit number of results', '20')
  .action(async (options) => {
    const providers = listProviders({
      limit: parseInt(options.limit, 10),
    });

    outputList(providers, options, 'providers');
  });

function outputList<T>(
  items: T[],
  options: { json?: boolean; jsonl?: boolean; format?: string },
  type: string
): void {
  if (options.json || options.format === 'json') {
    console.log(JSON.stringify({ [type]: items }, null, 2));
  } else if (options.jsonl || options.format === 'jsonl') {
    for (const item of items) {
      console.log(JSON.stringify(item));
    }
  } else if (options.format === 'table' || !options.format) {
    if (items.length === 0) {
      console.log(`No ${type} found.`);
      return;
    }
    console.log(JSON.stringify(items, null, 2));
  }
}
