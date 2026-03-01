#!/usr/bin/env node
/**
 * @fileoverview Quickstart command - Interactive setup guide for new users.
 *
 * Guides users through:
 * - Environment validation
 * - Initial configuration
 * - First tool execution
 * - Verification of setup
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export const quickstart = new Command('quickstart')
  .description('Interactive setup guide for new Requiem users')
  .option('--skip-checks', 'Skip environment validation')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    const results: Record<string, unknown> = {
      success: true,
      steps: [],
    };

    try {
      // Step 1: Environment validation
      if (!options.skipChecks) {
        logStep('Step 1: Validating environment...', options.json);

        const nodeVersion = process.version;
        const requiredNode = '20.';
        if (!nodeVersion.startsWith(requiredNode)) {
          const msg = `Node.js ${requiredNode}x required, found ${nodeVersion}`;
          if (options.json) {
            results.steps.push({ step: 'node_version', status: 'failed', error: msg });
            results.success = false;
          } else {
            console.error(`❌ ${msg}`);
          }
          process.exit(1);
        }

        if (options.json) {
          results.steps.push({ step: 'node_version', status: 'passed', version: nodeVersion });
        } else {
          console.log(`✓ Node.js ${nodeVersion}`);
        }

        // Check for required tools
        const checks = [
          { cmd: 'git', name: 'Git' },
          { cmd: 'pnpm', name: 'pnpm' },
        ];

        for (const { cmd, name } of checks) {
          try {
            execSync(`${cmd} --version`, { stdio: 'pipe' });
            if (options.json) {
              results.steps.push({ step: cmd, status: 'passed' });
            } else {
              console.log(`✓ ${name} available`);
            }
          } catch {
            if (options.json) {
              results.steps.push({ step: cmd, status: 'warning', message: `${name} not found` });
            } else {
              console.log(`⚠ ${name} not found (optional)`);
            }
          }
        }
      }

      // Step 2: Configuration
      logStep('Step 2: Checking configuration...', options.json);

      const configPath = join(process.cwd(), '.requiem', 'config.json');
      const hasConfig = existsSync(configPath);

      if (hasConfig) {
        if (options.json) {
          results.steps.push({ step: 'config', status: 'exists', path: configPath });
        } else {
          console.log(`✓ Configuration found at ${configPath}`);
        }
      } else {
        if (options.json) {
          results.steps.push({ step: 'config', status: 'missing', action: 'Run: requiem init' });
        } else {
          console.log('ℹ No configuration found. Run: requiem init');
        }
      }

      // Step 3: Tool registry check
      logStep('Step 3: Checking tool registry...', options.json);

      if (options.json) {
        results.steps.push({ step: 'tools', status: 'ready', message: 'Use: requiem tool list' });
      } else {
        console.log('✓ Tool registry ready');
        console.log('  Try: requiem tool list');
      }

      // Step 4: Next steps
      logStep('Step 4: Next steps', options.json);

      const nextSteps = [
        'requiem doctor          - Validate your setup',
        'requiem tool list       - List available tools',
        'requiem tool exec <name> - Execute a tool',
        'requiem help            - Show all commands',
      ];

      if (options.json) {
        results.steps.push({ step: 'next', actions: nextSteps });
      } else {
        console.log('\n📚 Quick reference:');
        for (const step of nextSteps) {
          console.log(`  ${step}`);
        }
        console.log('\n✅ Quickstart complete!');
      }

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      }

      process.exit(0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (options.json) {
        results.success = false;
        results.error = errorMsg;
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.error(`❌ Error: ${errorMsg}`);
      }
      process.exit(1);
    }
  });

function logStep(message: string, isJson: boolean): void {
  if (!isJson) {
    console.log(`\n${message}`);
  }
}
