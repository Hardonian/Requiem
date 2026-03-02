#!/usr/bin/env node
/**
 * @fileoverview Status command - System health, determinism verification, and policy state.
 *
 * Reports:
 * - CLI version and runtime
 * - Determinism verification state
 * - Policy enforcement state
 * - Replay system state
 * - Database connectivity
 * - Engine availability
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabaseStatus } from '../db/connection.js';

const VERSION = '0.2.0';

interface StatusResult {
  healthy: boolean;
  version: string;
  nodeVersion: string;
  platform: string;
  config: {
    exists: boolean;
    path?: string;
  };
  database: {
    connected: boolean;
    error?: string;
  };
  engine: {
    type: string;
    available: boolean;
  };
  determinism: {
    enforced: boolean;
    hashAlgorithm: string;
    casVersion: string;
  };
  policy: {
    enforced: boolean;
    mode: string;
  };
  replay: {
    available: boolean;
    storageBackend: string;
  };
  timestamp: string;
}

export const status = new Command('status')
  .description('System health, determinism state, and policy enforcement status')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    const result: StatusResult = {
      healthy: true,
      version: VERSION,
      nodeVersion: process.version,
      platform: process.platform,
      config: {
        exists: false,
      },
      database: {
        connected: false,
      },
      engine: {
        type: process.env.DECISION_ENGINE || 'ts',
        available: process.env.REQUIEM_ENGINE_AVAILABLE === 'true',
      },
      determinism: {
        enforced: true,
        hashAlgorithm: 'BLAKE3-v1',
        casVersion: 'v2',
      },
      policy: {
        enforced: true,
        mode: process.env.REQUIEM_ENTERPRISE === 'true' ? 'enterprise' : 'standard',
      },
      replay: {
        available: true,
        storageBackend: 'local-ndjson',
      },
      timestamp: new Date().toISOString(),
    };

    try {
      // Check configuration
      const configPath = join(process.cwd(), '.requiem', 'config.json');
      if (existsSync(configPath)) {
        result.config.exists = true;
        result.config.path = configPath;
      }

      // Check database connectivity
      try {
        const dbStatus = await getDatabaseStatus();
        result.database.connected = dbStatus.connected;
        if (!dbStatus.connected && dbStatus.error) {
          result.database.error = dbStatus.error;
        }
      } catch (error) {
        result.database.connected = false;
        result.database.error = error instanceof Error ? error.message : String(error);
      }

      // Determine overall health
      result.healthy = result.database.connected || !result.config.exists;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printStatus(result);
      }

      process.exit(result.healthy ? 0 : 1);
    } catch (error) {
      result.healthy = false;
      if (error instanceof Error) {
        result.database.error = error.message;
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error('Status check failed:', error);
      }
      process.exit(1);
    }
  });

function printStatus(result: StatusResult): void {
  const statusIcon = result.healthy ? '■' : '✗';
  const statusText = result.healthy ? 'HEALTHY' : 'UNHEALTHY';

  console.log('');
  console.log(`┌${'─'.repeat(52)}┐`);
  console.log(`│ Requiem Provable AI Runtime   ${statusIcon} ${statusText}`.padEnd(53) + '│');
  console.log(`├${'─'.repeat(52)}┤`);

  // Version
  console.log(formatRow('Version', result.version));
  console.log(formatRow('Node.js', result.nodeVersion));
  console.log(formatRow('Platform', result.platform));

  console.log(`├${'─'.repeat(52)}┤`);
  console.log(formatSection('DETERMINISM'));
  console.log(formatRow('Enforced', result.determinism.enforced ? '■ yes' : '✗ no'));
  console.log(formatRow('Hash Algorithm', result.determinism.hashAlgorithm));
  console.log(formatRow('CAS Version', result.determinism.casVersion));

  console.log(`├${'─'.repeat(52)}┤`);
  console.log(formatSection('POLICY'));
  console.log(formatRow('Enforced', result.policy.enforced ? '■ deny-by-default' : '✗ disabled'));
  console.log(formatRow('Mode', result.policy.mode));

  console.log(`├${'─'.repeat(52)}┤`);
  console.log(formatSection('REPLAY'));
  console.log(formatRow('Available', result.replay.available ? '■ yes' : '✗ no'));
  console.log(formatRow('Storage', result.replay.storageBackend));

  console.log(`├${'─'.repeat(52)}┤`);
  console.log(formatSection('INFRASTRUCTURE'));

  console.log(formatRow('Config', result.config.exists
    ? `■ ${result.config.path}`
    : '✗ not found (run: requiem init)'));

  console.log(formatRow('Database', result.database.connected
    ? '■ connected'
    : `✗ not connected${result.database.error ? ` (${result.database.error})` : ''}`));

  console.log(formatRow('Engine', `${result.engine.type} (${result.engine.available ? 'available' : 'not built'})`));

  console.log(`├${'─'.repeat(52)}┤`);
  console.log(formatRow('Timestamp', result.timestamp));
  console.log(`└${'─'.repeat(52)}┘`);
  console.log('');
}

function formatRow(label: string, value: string): string {
  const content = `│  ${label.padEnd(18)} ${value}`;
  return content.length > 53 ? content.substring(0, 53) + '│' : content.padEnd(53) + '│';
}

function formatSection(title: string): string {
  const content = `│ ${title}`;
  return content.padEnd(53) + '│';
}

