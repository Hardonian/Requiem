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

if (vercelConfig.buildCommand !== 'pnpm --filter ready-layer build') {
  fail(`vercel buildCommand must be 'pnpm --filter ready-layer build' (found: ${vercelConfig.buildCommand ?? 'missing'})`);
}

if (!existsSync('ready-layer/.env.example')) {
  fail('Missing ready-layer/.env.example (required for environment contract)');
}

const envExample = readFileSync('ready-layer/.env.example', 'utf8');
for (const requiredKey of ['REQUIEM_API_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  if (!envExample.includes(`${requiredKey}=`)) {
    fail(`ready-layer/.env.example must include ${requiredKey}`);
  }
}

if (!webPackage.scripts?.build?.includes('next build')) {
  fail('ready-layer build script must execute next build');
}

console.log('✅ Deploy readiness contract is valid (local/CI/Vercel parity checks passed)');
