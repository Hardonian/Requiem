#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function readJson(path) {
  if (!existsSync(path)) {
    fail(`Missing required file: ${path}`);
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const rootPackage = readJson('package.json');
const webPackage = readJson('ready-layer/package.json');
const vercelConfig = readJson('vercel.json');

if (rootPackage.packageManager !== 'pnpm@8.15.0') {
  fail(`packageManager must be pnpm@8.15.0 (found: ${rootPackage.packageManager ?? 'missing'})`);
}

if (rootPackage.engines?.node !== '>=20.11.0') {
  fail(`root engines.node must be >=20.11.0 (found: ${rootPackage.engines?.node ?? 'missing'})`);
}

if (webPackage.engines?.node !== '>=20.11.0') {
  fail(`ready-layer engines.node must be >=20.11.0 (found: ${webPackage.engines?.node ?? 'missing'})`);
}

const nvmrc = readFileSync('.nvmrc', 'utf8').trim();
if (nvmrc !== '20.11.0') {
  fail(`.nvmrc must pin 20.11.0 (found: ${nvmrc || 'empty'})`);
}

if (vercelConfig.framework !== 'nextjs') {
  fail(`vercel framework must be nextjs (found: ${vercelConfig.framework ?? 'missing'})`);
}

if (vercelConfig.installCommand !== 'pnpm install --frozen-lockfile') {
  fail(`vercel installCommand must be 'pnpm install --frozen-lockfile' (found: ${vercelConfig.installCommand ?? 'missing'})`);
}

if (vercelConfig.buildCommand !== 'pnpm run build:vercel') {
  fail(`vercel buildCommand must be 'pnpm run build:vercel' (found: ${vercelConfig.buildCommand ?? 'missing'})`);
}

if (/(^|\s)(pnpm\s+install|npm\s+install|yarn\s+install)($|\s)/.test(vercelConfig.buildCommand)) {
  fail(`vercel buildCommand must not run a second install (found: ${vercelConfig.buildCommand})`);
}

if (!existsSync('ready-layer/.env.example')) {
  fail('Missing ready-layer/.env.example (required for environment contract)');
}

if (!existsSync('scripts/bootstrap-preflight.mjs')) {
  fail('Missing scripts/bootstrap-preflight.mjs (required for clean-room bootstrap diagnostics)');
}

if (!existsSync('scripts/verify-first-customer-flow.mjs')) {
  fail('Missing scripts/verify-first-customer-flow.mjs (required for canonical first-customer operator proof)');
}

const envExample = readFileSync('ready-layer/.env.example', 'utf8');
for (const requiredKey of ['REQUIEM_API_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'REQUIEM_AUTH_SECRET']) {
  if (!envExample.includes(`${requiredKey}=`)) {
    fail(`ready-layer/.env.example must include ${requiredKey}`);
  }
}

if (!webPackage.scripts?.build?.includes('next build')) {
  fail('ready-layer build script must execute next build');
}


const vercelBuildScript = rootPackage.scripts?.['build:vercel'];
if (vercelBuildScript !== 'pnpm --filter @requiem/ai build && pnpm --filter ready-layer build') {
  fail(`root scripts.build:vercel must preserve deterministic package order (found: ${vercelBuildScript ?? 'missing'})`);
}

if (/(^|\s)(pnpm\s+install|npm\s+install|yarn\s+install)($|\s)/.test(vercelBuildScript)) {
  fail('root scripts.build:vercel must not run install commands');
}

console.log('✅ Deploy readiness contract is valid (bootstrap/deploy/operator parity checks passed)');
