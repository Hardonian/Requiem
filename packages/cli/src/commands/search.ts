#!/usr/bin/env node
/**
 * @fileoverview Search command - Search and filter runs by various criteria.
 *
 * Supports filtering by:
 * - run_id: Exact or partial match
 * - fingerprint: Exact or prefix match
 * - error code: Error type match
 * - tool: Tool name match
 * - status: Run status
 * - time range: Since/until timestamps
 *
 * Output formats: --json, --jsonl, --table
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';

interface SearchResult {
  id: string;
  fingerprint: string;
  tool: string;
  timestamp: string;
  status: 'success' | 'failure' | 'pending';
  errorCode?: string;
  duration?: number;
  score?: number;
}

interface SearchOptions {
  query?: string;
  runId?: string;
  fingerprint?: string;
  errorCode?: string;
  tool?: string;
  status?: string;
  since?: string;
  until?: string;
  limit?: number;
}

function getRunsDir(): string {
  return join(process.cwd(), '.requiem', 'runs');
}

function searchRuns(options: SearchOptions): SearchResult[] {
  const runsDir = getRunsDir();

  if (!existsSync(runsDir)) {
    return [];
  }

  const files = readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));

  const results: SearchResult[] = [];
  const maxResults = options.limit || 50;

  for (const file of files) {
    if (results.length >= maxResults) break;

    try {
      const content = readFileSync(join(runsDir, file), 'utf-8');
      const run = JSON.parse(content);

      // Apply filters
      if (options.runId) {
        const runId = run.id || file.replace('.json', '');
        if (!runId.includes(options.runId)) continue;
      }

      if (options.fingerprint) {
        const fp = run.fingerprint || run.resultDigest || '';
        if (!fp.startsWith(options.fingerprint) && !fp.includes(options.fingerprint)) continue;
      }

      if (options.errorCode) {
        const errorCode = run.errorCode || run.error?.code || '';
        if (!errorCode.includes(options.errorCode)) continue;
      }

      if (options.tool) {
        const tool = run.tool || run.command || '';
        if (!tool.includes(options.tool)) continue;
      }

      if (options.status) {
        const status = run.status || (run.error ? 'failure' : 'success');
        if (status !== options.status) continue;
      }

      if (options.since) {
        const sinceDate = new Date(options.since);
        const runDate = new Date(run.timestamp || run.createdAt);
        if (runDate < sinceDate) continue;
      }

      if (options.until) {
        const untilDate = new Date(options.until);
        const runDate = new Date(run.timestamp || run.createdAt);
        if (runDate > untilDate) continue;
      }

      if (options.query) {
        // Full-text search across all fields
        const searchStr = JSON.stringify(run).toLowerCase();
        if (!searchStr.includes(options.query.toLowerCase())) continue;
      }

      results.push({
        id: run.id || file.replace('.json', ''),
        fingerprint: run.fingerprint || run.resultDigest || 'N/A',
        tool: run.tool || run.command || 'unknown',
        timestamp: run.timestamp || run.createdAt || new Date().toISOString(),
        status: run.status || (run.error ? 'failure' : 'success'),
        errorCode: run.errorCode || run.error?.code,
        duration: run.duration || run.executionTime,
      });
    } catch {
      // Skip invalid files
    }
  }

  return results;
}

export const search = new Command('search')
  .description('Search runs by various criteria')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('-q, --query <text>', 'Full-text search query')
  .option('--run-id <id>', 'Filter by run ID (partial match)')
  .option('-f, --fingerprint <hash>', 'Filter by fingerprint (prefix match)')
  .option('-e, --error-code <code>', 'Filter by error code')
  .option('-t, --tool <name>', 'Filter by tool name')
  .option('-s, --status <status>', 'Filter by status: success, failure, pending')
  .option('--since <time>', 'Filter runs since timestamp')
  .option('--until <time>', 'Filter runs until timestamp')
  .option('-l, --limit <n>', 'Limit number of results', '20')
  .option('--verbose', 'Show verbose output')
  .action(async (options) => {
    const results = searchRuns({
      query: options.query,
      runId: options.runId,
      fingerprint: options.fingerprint,
      errorCode: options.errorCode,
      tool: options.tool,
      status: options.status,
      since: options.since,
      until: options.until,
      limit: parseInt(options.limit, 10),
    });

    if (options.json || options.format === 'json') {
      console.log(JSON.stringify({ results }, null, 2));
    } else if (options.jsonl || options.format === 'jsonl') {
      for (const result of results) {
        console.log(JSON.stringify(result));
      }
    } else if (options.format === 'table' || !options.format) {
      if (results.length === 0) {
        console.log('No matching runs found.');
        return;
      }

      console.log('');
      console.log(`Found ${results.length} matching runs:`);
      console.log('');

      if (options.verbose) {
        console.log(
          'ID'.padEnd(12) +
          'FINGERPRINT'.padEnd(18) +
          'TOOL'.padEnd(15) +
          'STATUS'.padEnd(10) +
          'ERROR'.padEnd(15) +
          'TIMESTAMP'
        );
        console.log('-'.repeat(90));

        for (const r of results) {
          const error = r.errorCode || '-';
          console.log(
            r.id.slice(0, 12).padEnd(12) +
            r.fingerprint.slice(0, 16).padEnd(18) +
            r.tool.slice(0, 14).padEnd(15) +
            r.status.padEnd(10) +
            error.slice(0, 14).padEnd(15) +
            r.timestamp.split('T')[0]
          );
        }
      } else {
        console.log(
          'ID'.padEnd(12) +
          'TOOL'.padEnd(20) +
          'STATUS'.padEnd(10) +
          'DURATION' +
          'TIMESTAMP'
        );
        console.log('-'.repeat(70));

        for (const r of results) {
          const statusIcon = r.status === 'success' ? '✓' : r.status === 'failure' ? '✗' : '?';
          const duration = r.duration ? `${r.duration}ms` : '-';
          const time = r.timestamp.split('T')[0] || r.timestamp.slice(0, 10);
          console.log(
            r.id.slice(0, 12).padEnd(12) +
            r.tool.slice(0, 19).padEnd(20) +
            `${statusIcon} ${r.status}`.padEnd(10) +
            duration.padEnd(8) +
            time
          );
        }
      }

      console.log('');
    }
  });

// Search by fingerprint subcommand
search.command('fingerprint')
  .description('Search by fingerprint hash')
  .argument('<hash>', 'Fingerprint or prefix')
  .option('--json', 'Output in JSON format')
  .option('--limit <n>', 'Limit results', '20')
  .action(async (hash: string, options) => {
    const results = searchRuns({
      fingerprint: hash,
      limit: parseInt(options.limit, 10),
    });

    if (options.json) {
      console.log(JSON.stringify({ results }, null, 2));
    } else if (results.length === 0) {
      console.log(`No runs found matching fingerprint: ${hash}`);
    } else {
      console.log(`Found ${results.length} run(s):`);
      for (const r of results) {
        console.log(`  ${r.id} - ${r.tool} - ${r.status} - ${r.timestamp.split('T')[0]}`);
      }
    }
  });

// Search by error code subcommand
search.command('error')
  .description('Search by error code')
  .argument('<code>', 'Error code (e.g., E_POLICY_DENIED)')
  .option('--json', 'Output in JSON format')
  .option('--limit <n>', 'Limit results', '20')
  .action(async (code: string, options) => {
    const results = searchRuns({
      errorCode: code,
      limit: parseInt(options.limit, 10),
    });

    if (options.json) {
      console.log(JSON.stringify({ results }, null, 2));
    } else if (results.length === 0) {
      console.log(`No runs found with error code: ${code}`);
    } else {
      console.log(`Found ${results.length} failed run(s) with error code: ${code}`);
      for (const r of results) {
        console.log(`  ${r.id} - ${r.tool} - ${r.timestamp.split('T')[0]}`);
      }
    }
  });

// Search by tool subcommand
search.command('tool')
  .description('Search by tool name')
  .argument('<name>', 'Tool name')
  .option('--json', 'Output in JSON format')
  .option('--limit <n>', 'Limit results', '20')
  .option('--status <status>', 'Filter by status')
  .action(async (name: string, options) => {
    const results = searchRuns({
      tool: name,
      status: options.status,
      limit: parseInt(options.limit, 10),
    });

    if (options.json) {
      console.log(JSON.stringify({ results }, null, 2));
    } else if (results.length === 0) {
      console.log(`No runs found for tool: ${name}`);
    } else {
      console.log(`Found ${results.length} run(s) for tool: ${name}`);
      for (const r of results) {
        const statusIcon = r.status === 'success' ? '✓' : '✗';
        console.log(`  ${statusIcon} ${r.id} - ${r.status} - ${r.timestamp.split('T')[0]}`);
      }
    }
  });
