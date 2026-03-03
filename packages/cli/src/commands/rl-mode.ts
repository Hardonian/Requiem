/**
 * rl mode command - Show/set operator mode (intensity, thinking, tool policy)
 */

import { ModeSettingsRepository, ModeSettings } from '../db/operator-console.js';

const VALID_INTENSITIES: ModeSettings['intensity'][] = ['minimal', 'normal', 'aggressive'];
const VALID_THINKING_MODES: ModeSettings['thinking_mode'][] = ['fast', 'balanced', 'deep'];
const VALID_TOOL_POLICIES: ModeSettings['tool_policy'][] = ['deny_all', 'ask', 'allow_registered', 'allow_all'];

interface ModeResult {
  mode: ModeSettings;
}

export async function runMode(
  subcommand: string,
  args: string[],
  options: { json: boolean }
): Promise<number> {
  const repo = new ModeSettingsRepository();

  switch (subcommand) {
    case 'show':
      return runShow(repo, options);
    case 'set':
      return runSet(repo, args, options);
    default:
      console.error(`Unknown mode subcommand: ${subcommand}`);
      console.error('Usage: rl mode show|set');
      return 1;
  }
}

async function runShow(repo: ModeSettingsRepository, options: { json: boolean }): Promise<number> {
  const settings = repo.get('global');

  if (!settings) {
    console.error('Mode settings not initialized. Run: rl mode set intensity normal');
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify({ mode: settings }, null, 2));
  } else {
    printMode(settings);
  }

  return 0;
}

async function runSet(
  repo: ModeSettingsRepository,
  args: string[],
  options: { json: boolean }
): Promise<number> {
  if (args.length < 2) {
    console.error('Usage: rl mode set <setting> <value>');
    console.error('');
    console.error('Settings:');
    console.error('  intensity    minimal | normal | aggressive');
    console.error('  thinking     fast | balanced | deep');
    console.error('  tool-policy  deny_all | ask | allow_registered | allow_all');
    console.error('  max-iter     <number>');
    console.error('  timeout      <seconds>');
    return 1;
  }

  const setting = args[0];
  const value = args[1];

  const updates: Partial<Omit<ModeSettings, 'id' | 'updated_at'>> = {};

  switch (setting) {
    case 'intensity':
      if (!VALID_INTENSITIES.includes(value as ModeSettings['intensity'])) {
        console.error(`Invalid intensity: ${value}`);
        console.error(`Valid values: ${VALID_INTENSITIES.join(', ')}`);
        return 1;
      }
      updates.intensity = value as ModeSettings['intensity'];
      break;

    case 'thinking':
      if (!VALID_THINKING_MODES.includes(value as ModeSettings['thinking_mode'])) {
        console.error(`Invalid thinking mode: ${value}`);
        console.error(`Valid values: ${VALID_THINKING_MODES.join(', ')}`);
        return 1;
      }
      updates.thinking_mode = value as ModeSettings['thinking_mode'];
      break;

    case 'tool-policy':
      if (!VALID_TOOL_POLICIES.includes(value as ModeSettings['tool_policy'])) {
        console.error(`Invalid tool policy: ${value}`);
        console.error(`Valid values: ${VALID_TOOL_POLICIES.join(', ')}`);
        return 1;
      }
      updates.tool_policy = value as ModeSettings['tool_policy'];
      break;

    case 'max-iter':
    case 'max_iterations':
    case 'maxiter': {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        console.error('max-iter must be a positive number');
        return 1;
      }
      updates.max_iterations = num;
      break;
    }

    case 'timeout': {
      const seconds = parseInt(value, 10);
      if (isNaN(seconds) || seconds < 1) {
        console.error('timeout must be a positive number (seconds)');
        return 1;
      }
      updates.timeout_seconds = seconds;
      break;
    }

    default:
      console.error(`Unknown setting: ${setting}`);
      console.error('Valid settings: intensity, thinking, tool-policy, max-iter, timeout');
      return 1;
  }

  const updated = repo.update('global', updates);

  if (!updated) {
    console.error('Failed to update mode settings');
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify({ mode: updated }, null, 2));
  } else {
    console.log(`${setting} set to ${value}`);
    console.log('');
    printMode(updated);
  }

  return 0;
}

function printMode(mode: ModeSettings): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Operator Mode                                              │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Intensity:     ${mode.intensity.padEnd(42)}│`);
  console.log(`│  Thinking:      ${mode.thinking_mode.padEnd(42)}│`);
  console.log(`│  Tool Policy:   ${mode.tool_policy.padEnd(42)}│`);
  console.log(`│  Max Iterations: ${String(mode.max_iterations).padEnd(41)}│`);
  console.log(`│  Timeout:       ${String(mode.timeout_seconds).padEnd(42)}s│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Updated: ${mode.updated_at.padEnd(47)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

export default runMode;
