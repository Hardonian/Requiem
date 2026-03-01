#!/usr/bin/env node
/**
 * @fileoverview Status command - System health and connectivity check.
 *
 * Reports:
 * - CLI version
 * - Node.js version
 * - Configuration status
 * - Database connectivity
 * - Decision engine status
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabaseStatus } from '../db/connection';

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
  timestamp: string;
}

export const status = new Command('status')
  .description('Check system health and connectivity')
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
        console.error('❌ Status check failed:', error);
      }
      process.exit(1);
    }
  });

function printStatus(result: StatusResult): void {
  const statusIcon = result.healthy ? '✓' : '✗';
  const statusText = result.healthy ? 'healthy' : 'unhealthy';

  console.log(`\nRequiem CLI Status: ${statusIcon} ${statusText}`);
  console.log('=' .repeat(40));

  console.log(`\n📦 Version: ${result.version}`);
  console.log(`🟢 Node.js: ${result.nodeVersion}`);
  console.log(`💻 Platform: ${result.platform}`);

  console.log(`\n⚙️  Configuration:`);
  if (result.config.exists) {
    console.log(`  ✓ Found at ${result.config.path}`);
  } else {
    console.log(`  ✗ Not found (run: requiem init)`);
  }

  console.log(`\n🗄️  Database:`);
  if (result.database.connected) {
    console.log(`  ✓ Connected`);
  } else {
    console.log(`  ✗ Not connected`);
    if (result.database.error) {
      console.log(`    Error: ${result.database.error}`);
    }
  }

  console.log(`\n⚡ Engine:`);
  console.log(`  Type: ${result.engine.type}`);
  console.log(`  Available: ${result.engine.available ? 'Yes' : 'No'}`);

  console.log(`\n🕐 Timestamp: ${result.timestamp}`);
  console.log();
}
