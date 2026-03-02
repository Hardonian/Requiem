#!/usr/bin/env node
/**
 * CLI Surface CI Check
 * 
 * Fails CI if CLI surface changes without version bump.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const snapshotPath = join(rootDir, 'snapshots/cli-surface.json');
const cliPath = join(rootDir, 'packages/cli/src/cli.ts');

// Read the CLI source
const cliContent = readFileSync(cliPath, 'utf-8');

// Extract commands from the switch statement
function extractCommands(content) {
  const commands = [];
  const caseRegex = /case\s+['"]([^'"]+)['"]\s*:/g;
  const matches = content.matchAll(caseRegex);
  
  for (const m of matches) {
    const cmd = m[1];
    if (!commands.includes(cmd) && !cmd.startsWith('-')) {
      commands.push(cmd);
    }
  }
  
  return commands.sort();
}

// Extract flags
function extractFlags(content) {
  const flags = [];
  const flagRegex = /['"](--[\w-]+)['"]/g;
  const matches = content.matchAll(flagRegex);
  
  for (const m of matches) {
    const flag = m[1];
    if (!flags.includes(flag)) {
      flags.push(flag);
    }
  }
  
  return flags.sort();
}

function main() {
  console.log('=== CLI Surface CI Check ===\n');
  
  if (!existsSync(snapshotPath)) {
    console.log('❌ No CLI surface snapshot found. Run: node scripts/snapshot-cli-surface.mjs');
    process.exit(1);
  }
  
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
  const currentCommands = extractCommands(cliContent);
  const currentFlags = extractFlags(cliContent);
  
  // Read current version from package.json
  const pkgPath = join(rootDir, 'packages/cli/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const currentVersion = pkg.version;
  
  let hasChanges = false;
  const changes = {
    added: [],
    removed: []
  };
  
  // Check commands
  const snapCommands = snapshot.commands.list;
  
  for (const cmd of currentCommands) {
    if (!snapCommands.includes(cmd)) {
      changes.added.push(`command: ${cmd}`);
      hasChanges = true;
    }
  }
  
  for (const cmd of snapCommands) {
    if (!currentCommands.includes(cmd)) {
      changes.removed.push(`command: ${cmd}`);
      hasChanges = true;
    }
  }
  
  // Check flags
  const snapFlags = snapshot.flags.all;
  
  for (const flag of currentFlags) {
    if (!snapFlags.includes(flag)) {
      changes.added.push(`flag: ${flag}`);
      hasChanges = true;
    }
  }
  
  for (const flag of snapFlags) {
    if (!currentFlags.includes(flag)) {
      changes.removed.push(`flag: ${flag}`);
      hasChanges = true;
    }
  }
  
  // Check version
  const versionChanged = snapshot.version !== currentVersion;
  
  console.log(`Snapshot version: ${snapshot.version}`);
  console.log(`Package version:  ${currentVersion}`);
  console.log(`Commands:         ${snapCommands.length} (snapshot) → ${currentCommands.length} (current)`);
  console.log(`Flags:            ${snapFlags.length} (snapshot) → ${currentFlags.length} (current)`);
  
  if (hasChanges) {
    console.log('\n⚠️  CLI surface changes detected:\n');
    
    for (const change of changes.added) {
      console.log(`  + ${change}`);
    }
    for (const change of changes.removed) {
      console.log(`  - ${change}`);
    }
    
    if (!versionChanged) {
      console.log('\n❌ FAIL: CLI surface changed but version was not bumped!');
      console.log('   Either bump the version or revert the changes.');
      process.exit(1);
    } else {
      console.log('\n✅ Version bumped - changes accepted.');
      console.log('   Remember to update the snapshot: node scripts/snapshot-cli-surface.mjs');
    }
  } else {
    console.log('\n✅ CLI surface unchanged - CI PASS');
  }
}

main();
