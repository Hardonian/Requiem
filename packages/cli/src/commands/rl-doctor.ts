/**
 * rl doctor command - Validate environment and print fixes
 */

import { getDatabaseStatus } from '../db/connection.js';
import { ProviderConfigRepository, ModeSettingsRepository } from '../db/operator-console.js';
import { readConfig } from '../global-config.js';

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

export interface DoctorResult {
  version: string;
  timestamp: string;
  platform: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: DoctorCheck[];
}

export async function runDoctor(options: { json: boolean; fix?: boolean }): Promise<number> {
  const checks: DoctorCheck[] = [];

  // Check Node.js version
  checks.push(await checkNodeVersion());

  // Check database
  checks.push(await checkDatabase());

  // Check providers
  checks.push(await checkProviders());

  // Check configuration
  checks.push(await checkConfiguration());

  // Check environment variables
  checks.push(await checkEnvironment());

  // Check mode settings
  checks.push(await checkModeSettings());

  // Determine overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const status = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy';

  const result: DoctorResult = {
    version: '0.3.0',
    timestamp: new Date().toISOString(),
    platform: process.platform,
    status,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printDoctor(result, options.fix ?? false);
  }

  return hasFail ? 1 : 0;
}

async function checkNodeVersion(): Promise<DoctorCheck> {
  const majorVersion = parseInt(process.version.replace('v', '').split('.')[0]);
  const isCompatible = majorVersion >= 20;

  if (!isCompatible) {
    return {
      name: 'Node.js Version',
      status: 'fail',
      message: `Node.js ${process.version} is too old (requires >= 20)`,
      fix: 'Upgrade Node.js to version 20 or higher',
    };
  }

  return {
    name: 'Node.js Version',
    status: 'ok',
    message: `Node.js ${process.version}`,
  };
}

async function checkDatabase(): Promise<DoctorCheck> {
  const dbStatus = await getDatabaseStatus();

  if (!dbStatus.connected) {
    return {
      name: 'Database',
      status: 'fail',
      message: dbStatus.error || 'Database not connected',
      fix: 'Check database connection and permissions',
    };
  }

  return {
    name: 'Database',
    status: 'ok',
    message: `Connected (${dbStatus.tables?.length ?? 0} tables)`,
  };
}

async function checkProviders(): Promise<DoctorCheck> {
  try {
    const repo = new ProviderConfigRepository();
    const providers = repo.list();
    const enabled = providers.filter(p => p.enabled);

    if (enabled.length === 0) {
      return {
        name: 'Providers',
        status: 'warn',
        message: 'No providers enabled',
        fix: 'Enable at least one provider using: rl models enable <provider>',
      };
    }

    // Check for API keys
    const missingKeys: string[] = [];
    for (const provider of enabled) {
      if (provider.api_key_env_var && !process.env[provider.api_key_env_var]) {
        missingKeys.push(provider.api_key_env_var);
      }
    }

    if (missingKeys.length > 0) {
      return {
        name: 'Providers',
        status: 'warn',
        message: `${enabled.length} enabled, missing env: ${missingKeys.join(', ')}`,
        fix: `Set environment variables: export ${missingKeys.join('=')}=<your_key>`,
      };
    }

    return {
      name: 'Providers',
      status: 'ok',
      message: `${enabled.length}/${providers.length} providers enabled`,
    };
  } catch (e) {
    return {
      name: 'Providers',
      status: 'fail',
      message: `Error checking providers: ${(e as Error).message}`,
    };
  }
}

async function checkConfiguration(): Promise<DoctorCheck> {
  try {
    const config = readConfig();

    if (!config.defaultTenantId) {
      return {
        name: 'Configuration',
        status: 'warn',
        message: 'No default tenant configured',
        fix: 'Run: requiem init',
      };
    }

    return {
      name: 'Configuration',
      status: 'ok',
      message: `Tenant: ${config.defaultTenantId}`,
    };
  } catch (e) {
    return {
      name: 'Configuration',
      status: 'warn',
      message: 'Configuration file not found',
      fix: 'Run: requiem init',
    };
  }
}

async function checkEnvironment(): Promise<DoctorCheck> {
  const required = ['PATH', 'HOME'];
  const missing = required.filter(v => !process.env[v]);

  if (missing.length > 0) {
    return {
      name: 'Environment',
      status: 'fail',
      message: `Missing required variables: ${missing.join(', ')}`,
    };
  }

  return {
    name: 'Environment',
    status: 'ok',
    message: 'All required variables present',
  };
}

async function checkModeSettings(): Promise<DoctorCheck> {
  try {
    const repo = new ModeSettingsRepository();
    const settings = repo.get('global');

    if (!settings) {
      return {
        name: 'Mode Settings',
        status: 'warn',
        message: 'Mode settings not initialized',
        fix: 'Run: rl mode set intensity normal',
      };
    }

    return {
      name: 'Mode Settings',
      status: 'ok',
      message: `Intensity: ${settings.intensity}, Thinking: ${settings.thinking_mode}`,
    };
  } catch (e) {
    return {
      name: 'Mode Settings',
      status: 'warn',
      message: 'Could not load mode settings',
    };
  }
}

function printDoctor(result: DoctorResult, showFixes: boolean): void {
  const icons: Record<string, string> = { ok: '●', warn: '●', fail: '○', healthy: '●', degraded: '●', unhealthy: '○' };
  const colors = {
    ok: '\x1b[32m',   // green
    warn: '\x1b[33m', // yellow
    fail: '\x1b[31m', // red
    reset: '\x1b[0m',
  };

  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log(`│ ReadyLayer Doctor         ${icons[result.status]} ${result.status.toUpperCase()}`.padEnd(59) + '│');
  console.log('├────────────────────────────────────────────────────────────┤');

  for (const check of result.checks) {
    const icon = icons[check.status];
    const color = colors[check.status];
    const name = check.name.padEnd(18);
    const message = check.message.substring(0, 28).padEnd(28);

    // Use ANSI colors if stdout is TTY
    if (process.stdout.isTTY) {
      console.log(`│ ${color}${icon}${colors.reset} ${name} ${message} │`);
    } else {
      console.log(`│ ${icon} ${name} ${message} │`);
    }

    if (showFixes && check.fix) {
      console.log(`│   → ${check.fix.substring(0, 53).padEnd(53)}│`);
    }
  }

  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  ${result.timestamp.padEnd(55)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');

  if (!showFixes && result.checks.some(c => c.fix)) {
    console.log('Run with --fix to see suggested fixes');
    console.log('');
  }
}

export default runDoctor;
