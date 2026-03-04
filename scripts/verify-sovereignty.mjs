#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function listFiles(pattern) {
  const out = execSync(`rg --files ${pattern}`, { encoding: 'utf8' }).trim();
  return out ? out.split('\n') : [];
}

const violations = [];

for (const file of listFiles('ready-layer/src')) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes('packages/cli/src/db/')) {
    violations.push(`${file}: ReadyLayer must not import CLI DB write repositories`);
  }
}

for (const file of listFiles('packages/cli/src/commands')) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes('LearningSignalRepository.create(')) {
    violations.push(`${file}: direct repository write detected; route writes through KernelService appendEvent gate`);
  }
}

if (violations.length > 0) {
  console.error('Sovereignty boundary violations detected:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('✓ Sovereignty boundaries verified');
