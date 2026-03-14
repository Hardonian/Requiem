#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredDocs = [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  'docs/platform-index.md',
  'docs/architecture.md',
  'docs/cli.md',
  'docs/proof-engine.md',
  'docs/operators.md',
  'docs/examples.md',
  'docs/repo-state.md',
];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const file of requiredDocs) {
  if (!existsSync(file)) {
    console.error(`❌ Missing required repository file: ${file}`);
    process.exit(1);
  }
}

console.log('✅ Required repository docs and policy files present');

run('pnpm', ['lint']);
run('pnpm', ['typecheck']);
run('pnpm', ['build']);
run('pnpm', ['test']);
run('node', ['scripts/run-tsx.mjs', 'scripts/verify-routes.ts']);

console.log('✅ Repository verification checks passed');
