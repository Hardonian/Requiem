#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedPnpm = String(pkg.packageManager ?? 'pnpm@8.15.0');
const expectedNode = pkg.engines?.node ?? '>=20.11.0';
const userAgent = process.env.npm_config_user_agent ?? '';
const execPath = process.env.npm_execpath ?? '';

const usingPnpm = userAgent.includes('pnpm/') || execPath.includes('pnpm');
if (!usingPnpm) {
  console.error(`This repository must be installed with ${expectedPnpm}, not npm/yarn.`);
  console.error('Remediation: run `corepack enable && corepack prepare pnpm@8.15.0 --activate`, then rerun `pnpm install --frozen-lockfile`.');
  process.exit(1);
}

const version = process.versions.node;
const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
if (!match) {
  console.error(`Unable to parse active Node version (${version}). Expected ${expectedNode}.`);
  process.exit(1);
}
const [, major, minor] = match.map(Number);
if (major < 20 || (major === 20 && minor < 11)) {
  console.error(`Active Node ${version} does not satisfy ${expectedNode}.`);
  console.error('Remediation: use `.nvmrc` / Node 20.11.0+ before install.');
  process.exit(1);
}
