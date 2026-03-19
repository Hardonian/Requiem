#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import https from 'node:https';

const rootPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const requiredNode = rootPackage.engines?.node ?? '>=20.11.0';
const requiredPnpm = String(rootPackage.packageManager ?? 'pnpm@8.15.0').split('@')[1] ?? '8.15.0';
const expectedNvmrc = existsSync(new URL('../.nvmrc', import.meta.url))
  ? readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim()
  : null;
const jsonOutput = process.argv.includes('--json');
const skipNetwork = process.argv.includes('--skip-network') || process.env.BOOTSTRAP_SKIP_NETWORK === '1';

const checks = [];
let failed = 0;
let warnings = 0;

function addCheck(ok, name, detail, remediation = '', warning = false) {
  checks.push({ ok, name, detail, remediation, warning });
  if (!ok) {
    failed += 1;
  } else if (warning) {
    warnings += 1;
  }
}

function parseVersion(raw) {
  const match = String(raw).match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match[0] : null;
}

function versionGte(actual, required) {
  const a = actual.split('.').map(Number);
  const b = required.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return true;
}

function commandVersion(command, args = ['--version']) {
  const res = spawnSync(command, args, { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    return null;
  }
  return parseVersion(res.stdout || res.stderr || '');
}

function commandOutput(command, args) {
  const res = spawnSync(command, args, { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    return null;
  }
  return (res.stdout || res.stderr || '').trim();
}

function normalizeRegistryUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 'https://registry.npmjs.org/';
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.pathname || parsed.pathname === '') {
      parsed.pathname = '/';
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function resolvePackageRegistry() {
  return normalizeRegistryUrl(
    process.env.npm_config_registry
      ?? process.env.NPM_CONFIG_REGISTRY
      ?? commandOutput('pnpm', ['config', 'get', 'registry'])
      ?? 'https://registry.npmjs.org/',
  );
}

function registryProbeUrl(registryUrl) {
  try {
    const parsed = new URL(registryUrl);
    if (parsed.hostname === 'registry.npmjs.org') {
      return new URL('/pnpm', parsed).toString();
    }
    return parsed.toString();
  } catch {
    return registryUrl;
  }
}

function describeNetworkError(error) {
  if (!(error instanceof Error)) {
    return 'unknown network error';
  }
  const withCode = 'code' in error && typeof error.code === 'string'
    ? `${error.code}: ${error.message || 'network error'}`
    : error.message || error.name || 'network error';
  return withCode;
}

async function checkRegistry() {
  if (skipNetwork) {
    addCheck(true, 'npm registry reachability', 'Skipped by --skip-network / BOOTSTRAP_SKIP_NETWORK=1.', '', true);
    return;
  }

  const configuredRegistry = resolvePackageRegistry();
  const probeUrl = registryProbeUrl(configuredRegistry);

  await new Promise((resolve) => {
    const req = https.get(probeUrl, { timeout: 3000 }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
        addCheck(true, 'npm registry reachability', `${configuredRegistry} responded with HTTP ${res.statusCode}.`);
      } else {
        addCheck(false, 'npm registry reachability', `${configuredRegistry} returned HTTP ${res.statusCode ?? 0}.`, `Confirm outbound HTTPS access to ${configuredRegistry} before running pnpm install --frozen-lockfile.`);
      }
      res.resume();
      resolve();
    });
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error(`Timed out probing ${probeUrl}`), { code: 'ETIMEDOUT' }));
    });
    req.on('error', (error) => {
      addCheck(
        false,
        'npm registry reachability',
        `Could not reach ${configuredRegistry}: ${describeNetworkError(error)}.`,
        `Provide outbound HTTPS access to ${configuredRegistry} or configure pnpm to use a reachable internal npm mirror before install.`,
      );
      resolve();
    });
  });
}

const nodeVersion = parseVersion(process.version);
if (nodeVersion && versionGte(nodeVersion, '20.11.0')) {
  addCheck(true, 'Node.js', `Node ${nodeVersion} satisfies ${requiredNode}.`);
} else {
  addCheck(false, 'Node.js', `Node ${nodeVersion ?? process.version} does not satisfy ${requiredNode}.`, `Install Node ${expectedNvmrc ?? '20.11.0'} or newer before continuing.`);
}

if (expectedNvmrc) {
  const aligned = nodeVersion ? versionGte(nodeVersion, expectedNvmrc) : false;
  addCheck(aligned, '.nvmrc alignment', aligned ? `Active Node ${nodeVersion} satisfies pinned .nvmrc ${expectedNvmrc}.` : `Active Node ${nodeVersion ?? 'unknown'} is older than pinned .nvmrc ${expectedNvmrc}.`, `Use \`nvm use ${expectedNvmrc}\` or an equivalent version manager command before install.`);
}

const corepackVersion = commandVersion('corepack');
if (corepackVersion) {
  addCheck(true, 'corepack', `corepack ${corepackVersion} is available.`);
} else {
  addCheck(false, 'corepack', 'corepack is not available on PATH.', 'Install a Node distribution with corepack, then run `corepack enable` and `corepack prepare pnpm@8.15.0 --activate`.');
}

const pnpmVersion = commandVersion('pnpm');
if (pnpmVersion && versionGte(pnpmVersion, requiredPnpm)) {
  addCheck(true, 'pnpm', `pnpm ${pnpmVersion} satisfies required ${requiredPnpm}.`);
} else if (pnpmVersion) {
  addCheck(false, 'pnpm', `pnpm ${pnpmVersion} is older than required ${requiredPnpm}.`, `Run \`corepack prepare pnpm@${requiredPnpm} --activate\` before install.`);
} else {
  addCheck(false, 'pnpm', 'pnpm is not available on PATH.', `Run \`corepack enable\` and \`corepack prepare pnpm@${requiredPnpm} --activate\` before install.`);
}

addCheck(existsSync(new URL('../pnpm-lock.yaml', import.meta.url)), 'lockfile', existsSync(new URL('../pnpm-lock.yaml', import.meta.url)) ? 'pnpm-lock.yaml is present.' : 'pnpm-lock.yaml is missing.', 'Restore the lockfile before attempting a first-customer install.');
addCheck(existsSync(new URL('../ready-layer/.env.example', import.meta.url)), 'ReadyLayer env example', existsSync(new URL('../ready-layer/.env.example', import.meta.url)) ? 'ready-layer/.env.example is present.' : 'ready-layer/.env.example is missing.', 'Restore ready-layer/.env.example so operators have a deploy-time contract.');

await checkRegistry();

if (jsonOutput) {
  console.log(JSON.stringify({ ok: failed === 0, failed, warnings, checks }, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}

console.log('Bootstrap preflight');
for (const check of checks) {
  const icon = check.ok ? (check.warning ? '⚠️' : '✅') : '❌';
  console.log(`${icon} ${check.name}: ${check.detail}`);
  if (!check.ok && check.remediation) {
    console.log(`   remediation: ${check.remediation}`);
  }
}

if (failed > 0) {
  console.error(`\nBootstrap preflight found ${failed} blocking issue(s). Resolve them before running pnpm install --frozen-lockfile.`);
  process.exit(1);
}

console.log(`\nBootstrap preflight passed with ${warnings} warning(s). Safe next step: pnpm install --frozen-lockfile`);
