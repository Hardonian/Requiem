/**
 * rl status command - System health and ready state
 */

import { ProviderConfigRepository, ModeSettingsRepository } from '../db/operator-console.js';
import { getDatabaseStatus } from '../db/connection.js';

const VERSION = '0.3.0';

interface StatusResult {
  healthy: boolean;
  ready: boolean;
  version: string;
  node_version: string;
  platform: string;
  timestamp: string;
  components: {
    database: { connected: boolean; error?: string };
    prompts: { count: number };
    providers: { count: number; enabled: number };
    mode: { configured: boolean };
  };
  mode?: {
    intensity: string;
    thinking_mode: string;
    tool_policy: string;
  };
}

export async function runStatus(options: { json: boolean }): Promise<number> {
  const modeRepo = new ModeSettingsRepository();
  const providerRepo = new ProviderConfigRepository();

  // Check database
  const dbStatus = await getDatabaseStatus();

  // Get mode settings
  const modeSettings = modeRepo.get('global');

  // Count providers
  const providers = providerRepo.list();
  const enabledProviders = providers.filter(p => p.enabled);

  const result: StatusResult = {
    healthy: dbStatus.connected,
    ready: dbStatus.connected && enabledProviders.length > 0,
    version: VERSION,
    node_version: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    components: {
      database: {
        connected: dbStatus.connected,
        error: dbStatus.error,
      },
      prompts: { count: 0 }, // Would need to count from prompts table
      providers: {
        count: providers.length,
        enabled: enabledProviders.length,
      },
      mode: { configured: !!modeSettings },
    },
  };

  if (modeSettings) {
    result.mode = {
      intensity: modeSettings.intensity,
      thinking_mode: modeSettings.thinking_mode,
      tool_policy: modeSettings.tool_policy,
    };
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printStatus(result);
  }

  return result.healthy ? 0 : 1;
}

function printStatus(result: StatusResult): void {
  const statusIcon = result.healthy ? '●' : '○';
  const readyIcon = result.ready ? '●' : '○';

  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log(`│ ReadyLayer Operator Console   ${statusIcon} ${result.healthy ? 'HEALTHY' : 'DEGRADED'}`.padEnd(59) + '│');
  console.log(`│                               ${readyIcon} ${result.ready ? 'READY' : 'NOT READY'}`.padEnd(59) + '│');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Version:           ${result.version.padEnd(40)}│`);
  console.log(`│  Node.js:           ${result.node_version.padEnd(40)}│`);
  console.log(`│  Platform:          ${result.platform.padEnd(40)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ COMPONENTS                                                 │');
  console.log(`│  Database:          ${(result.components.database.connected ? '● connected' : '○ disconnected').padEnd(40)}│`);
  if (result.components.database.error) {
    console.log(`│  Error:             ${result.components.database.error.substring(0, 38).padEnd(40)}│`);
  }
  console.log(`│  Providers:         ${(`${result.components.providers.enabled}/${result.components.providers.count} enabled`).padEnd(40)}│`);
  console.log(`│  Mode:              ${(result.components.mode.configured ? '● configured' : '○ not configured').padEnd(40)}│`);

  if (result.mode) {
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ CURRENT MODE                                               │');
    console.log(`│  Intensity:         ${result.mode.intensity.padEnd(40)}│`);
    console.log(`│  Thinking:          ${result.mode.thinking_mode.padEnd(40)}│`);
    console.log(`│  Tool Policy:       ${result.mode.tool_policy.padEnd(40)}│`);
  }

  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Timestamp:         ${result.timestamp.padEnd(40)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

export default runStatus;
