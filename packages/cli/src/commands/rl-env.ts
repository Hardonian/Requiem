/**
 * rl env command - Show environment configuration
 */

import { readConfig } from '../global-config.js';
import { ModeSettingsRepository, ProviderConfigRepository } from '../db/operator-console.js';

interface EnvResult {
  node: {
    version: string;
    platform: string;
    arch: string;
    execPath: string;
  };
  environment: Record<string, string>;
  config: {
    path?: string;
    values: Record<string, unknown>;
  };
  mode?: {
    intensity: string;
    thinking_mode: string;
    tool_policy: string;
    max_iterations: number;
    timeout_seconds: number;
  };
  providers: Array<{
    id: string;
    name: string;
    enabled: boolean;
    api_key_set: boolean;
  }>;
}

export async function runEnv(options: { json: boolean }): Promise<number> {
  const modeRepo = new ModeSettingsRepository();
  const providerRepo = new ProviderConfigRepository();

  // Collect environment variables (with redaction for sensitive values)
  const envVars: Record<string, string> = {};
  const relevantPrefixes = ['RL_', 'REQUIEM_', 'ANTHROPIC_', 'OPENAI_', 'NODE_'];

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;

    // Include relevant prefixed variables
    const isRelevant = relevantPrefixes.some(p => key.startsWith(p));
    const isGeneral = ['HOME', 'USER', 'SHELL', 'TERM', 'PWD', 'PATH'].includes(key);

    if (isRelevant || isGeneral) {
      // Redact potential secrets
      if (/key|secret|token|password|auth|credential/i.test(key)) {
        envVars[key] = value ? '[REDACTED]' : '';
      } else if (key === 'PATH') {
        // Show first few path entries
        const paths = value.split(':').slice(0, 3);
        envVars[key] = paths.join(':') + (value.split(':').length > 3 ? ':...' : '');
      } else {
        envVars[key] = value;
      }
    }
  }

  // Get config
  const config = readConfig();

  // Get mode settings
  const modeSettings = modeRepo.get('global');

  // Get providers
  const providers = providerRepo.list();

  const result: EnvResult = {
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      execPath: process.execPath,
    },
    environment: envVars,
    config: {
      values: config,
    },
    providers: providers.map(p => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      api_key_set: p.api_key_env_var ? !!process.env[p.api_key_env_var] : false,
    })),
  };

  if (modeSettings) {
    result.mode = {
      intensity: modeSettings.intensity,
      thinking_mode: modeSettings.thinking_mode,
      tool_policy: modeSettings.tool_policy,
      max_iterations: modeSettings.max_iterations,
      timeout_seconds: modeSettings.timeout_seconds,
    };
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printEnv(result);
  }

  return 0;
}

function printEnv(result: EnvResult): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ ReadyLayer Environment                                     │');
  console.log('├────────────────────────────────────────────────────────────┤');

  // Node section
  console.log('│ NODE.JS                                                    │');
  console.log(`│  Version:     ${result.node.version.padEnd(44)}│`);
  console.log(`│  Platform:    ${result.node.platform.padEnd(44)}│`);
  console.log(`│  Arch:        ${result.node.arch.padEnd(44)}│`);

  // Mode section
  if (result.mode) {
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ MODE SETTINGS                                              │');
    console.log(`│  Intensity:   ${result.mode.intensity.padEnd(44)}│`);
    console.log(`│  Thinking:    ${result.mode.thinking_mode.padEnd(44)}│`);
    console.log(`│  Tool Policy: ${result.mode.tool_policy.padEnd(44)}│`);
    console.log(`│  Max Iter:    ${String(result.mode.max_iterations).padEnd(44)}│`);
    console.log(`│  Timeout:     ${String(result.mode.timeout_seconds).padEnd(44)}│`);
  }

  // Providers section
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ PROVIDERS                                                  │');
  for (const provider of result.providers) {
    const status = provider.enabled ? (provider.api_key_set ? '●' : '○') : ' ';
    const name = provider.name.padEnd(12);
    const keyStatus = provider.enabled
      ? (provider.api_key_set ? 'key set' : 'key missing')
      : 'disabled';
    console.log(`│  ${status} ${name} ${keyStatus.padEnd(37)}│`);
  }

  // Environment section
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ RELEVANT ENVIRONMENT VARIABLES                             │');
  const sortedKeys = Object.keys(result.environment).sort();
  for (const key of sortedKeys) {
    const value = result.environment[key];
    const displayValue = value.length > 40 ? value.substring(0, 37) + '...' : value;
    console.log(`│  ${key.padEnd(12)} = ${displayValue.padEnd(39)}│`);
  }

  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

export default runEnv;
