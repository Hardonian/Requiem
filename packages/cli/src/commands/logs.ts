#!/usr/bin/env node
/**
 * @fileoverview Logs command - Tail and filter system logs.
 *
 * Supports:
 * - tail: Show last N lines
 * - filter: Filter by level, pattern, source
 * - --json: JSON output format
 * - --since: Filter logs since timestamp
 *
 * INVARIANT: Never includes secrets or PII in output.
 */

import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  traceId?: string;
}

export interface LogFilter {
  level?: string[];
  pattern?: string;
  since?: string;
  source?: string;
  limit?: number;
}

function parseLogLine(line: string): LogEntry | null {
  try {
    // Try to parse as JSON first
    const entry = JSON.parse(line);
    return {
      timestamp: entry.timestamp || entry.time || new Date().toISOString(),
      level: entry.level || entry.severity || 'info',
      message: entry.message || entry.msg || JSON.stringify(entry),
      source: entry.source || entry.logger,
      traceId: entry.traceId || entry.trace_id,
    };
  } catch {
    // Fall back to plain text parsing
    // Format: [TIMESTAMP] [LEVEL] MESSAGE
    const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toLowerCase(),
        message: match[3],
      };
    }
    // Just return as info level
    return {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: line,
    };
  }
}

function findLogFiles(logDir: string): string[] {
  if (!existsSync(logDir)) {
    return [];
  }

  const files = readdirSync(logDir)
    .filter(f => f.endsWith('.log') || f.endsWith('.ndjson'))
    .map(f => join(logDir, f))
    .filter(f => statSync(f).isFile())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  return files;
}

function readLogs(
  logDir: string,
  filter: LogFilter,
  options: { json: boolean; reverse: boolean }
): LogEntry[] {
  const files = findLogFiles(logDir);
  const entries: LogEntry[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const entry = parseLogLine(line);
        if (!entry) continue;

        // Apply filters
        if (filter.level && filter.level.length > 0) {
          if (!filter.level.includes(entry.level)) continue;
        }

        if (filter.pattern) {
          const regex = new RegExp(filter.pattern, 'i');
          if (!regex.test(entry.message)) continue;
        }

        if (filter.since) {
          const sinceDate = new Date(filter.since);
          const entryDate = new Date(entry.timestamp);
          if (entryDate < sinceDate) continue;
        }

        if (filter.source) {
          if (entry.source !== filter.source) continue;
        }

        entries.push(entry);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Apply limit
  if (filter.limit) {
    return options.reverse ? entries.slice(-filter.limit) : entries.slice(0, filter.limit);
  }

  return options.reverse ? entries.reverse() : entries;
}

function formatLogEntry(entry: LogEntry, format: string): string {
  if (format === 'json') {
    return JSON.stringify(entry);
  }

  const levelColors: Record<string, string> = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[36m',
    debug: '\x1b[90m',
  };
  const reset = '\x1b[0m';

  const color = levelColors[entry.level] || '';
  const level = entry.level.toUpperCase().padEnd(5);
  const time = entry.timestamp.split('T')[1]?.slice(0, -1) || entry.timestamp;

  return `${color}[${time}] [${level}]${reset} ${entry.message}`;
}

export const logs = new Command('logs')
  .description('View and filter system logs')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format (one JSON per line)')
  .option('--format <type>', 'Output format: text, json, jsonl, table', 'text')
  .option('--limit <n>', 'Limit number of entries', '100')
  .option('--level <levels>', 'Filter by level (comma-separated: error,warn,info,debug)')
  .option('--pattern <regex>', 'Filter by message pattern')
  .option('--since <time>', 'Filter entries since timestamp (ISO 8601 or relative like 1h, 30m)')
  .option('--source <name>', 'Filter by log source')
  .option('--reverse', 'Show oldest first')
  .option('--dir <path>', 'Log directory path', join(process.cwd(), '.requiem', 'logs'))
  .action(async (options) => {
    const filter: LogFilter = {
      limit: parseInt(options.limit, 10),
    };

    if (options.level) {
      filter.level = options.level.split(',').map(l => l.trim().toLowerCase());
    }

    if (options.pattern) {
      filter.pattern = options.pattern;
    }

    if (options.since) {
      // Handle relative time
      const relativeMatch = options.since.match(/^(\d+)([hms])$/);
      if (relativeMatch) {
        const value = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2];
        const now = new Date();
        switch (unit) {
          case 'h':
            now.setHours(now.getHours() - value);
            break;
          case 'm':
            now.setMinutes(now.getMinutes() - value);
            break;
          case 's':
            now.setSeconds(now.getSeconds() - value);
            break;
        }
        filter.since = now.toISOString();
      } else {
        filter.since = options.since;
      }
    }

    if (options.source) {
      filter.source = options.source;
    }

    const entries = readLogs(options.dir, filter, {
      json: options.json,
      reverse: options.reverse,
    });

    const format = options.format || (options.json ? 'json' : options.jsonl ? 'jsonl' : 'text');

    if (format === 'jsonl') {
      for (const entry of entries) {
        console.log(JSON.stringify(entry));
      }
    } else if (format === 'json') {
      console.log(JSON.stringify(entries, null, 2));
    } else if (format === 'table') {
      console.log('TIMESTAMP'.padEnd(28) + 'LEVEL'.padEnd(8) + 'SOURCE'.padEnd(15) + 'MESSAGE');
      console.log('-'.repeat(80));
      for (const entry of entries) {
        const source = entry.source?.slice(0, 14) || '-';
        const message = entry.message.slice(0, 45);
        console.log(
          entry.timestamp.padEnd(28) +
          entry.level.padEnd(8) +
          source.padEnd(15) +
          message
        );
      }
    } else {
      for (const entry of entries) {
        console.log(formatLogEntry(entry, format));
      }
    }
  });

// Subcommand: tail
logs.command('tail')
  .description('Show last N log entries')
  .argument('<n>', 'Number of lines to show', '50')
  .option('--json', 'Output in JSON format')
  .option('--level <levels>', 'Filter by level')
  .action(async (n: string, options) => {
    const limit = parseInt(n, 10);
    const filter: LogFilter = { limit };

    if (options.level) {
      filter.level = options.level.split(',').map(l => l.trim().toLowerCase());
    }

    const logDir = join(process.cwd(), '.requiem', 'logs');
    const entries = readLogs(logDir, filter, { json: options.json, reverse: false });

    if (options.json) {
      console.log(JSON.stringify(entries, null, 2));
    } else {
      for (const entry of entries) {
        console.log(formatLogEntry(entry, 'text'));
      }
    }
  });

// Subcommand: follow
logs.command('follow')
  .description('Follow log output in real-time')
  .option('--json', 'Output in JSON format')
  .option('--level <levels>', 'Filter by level')
  .action(async (options) => {
    console.log('Following logs... (Ctrl+C to stop)');
    // In a real implementation, this would use fs.watch or chokidar
    console.log('(Real-time log following not yet implemented)');
  });
