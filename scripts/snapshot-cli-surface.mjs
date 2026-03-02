#!/usr/bin/env node
/**
 * CLI Surface Snapshot Generator
 * 
 * Captures the complete CLI interface for regression detection.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the CLI source
const cliPath = join(rootDir, 'packages/cli/src/cli.ts');
const cliContent = readFileSync(cliPath, 'utf-8');

// Extract commands from the switch statement
function extractCommands(content) {
  const commands = [];
  
  // Match case statements with string literals
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

// Extract flags from the content
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

// Extract exit codes from exit-codes.ts
function extractExitCodes() {
  try {
    const exitCodesPath = join(rootDir, 'packages/cli/src/core/exit-codes.ts');
    const content = readFileSync(exitCodesPath, 'utf-8');
    
    const exitCodes = {};
    const enumRegex = /(\w+)\s*=\s*(\d+)/g;
    const matches = content.matchAll(enumRegex);
    
    for (const m of matches) {
      exitCodes[m[1]] = parseInt(m[2]);
    }
    
    return exitCodes;
  } catch {
    return {};
  }
}

function main() {
  console.log('=== CLI Surface Snapshot ===\n');
  
  const commands = extractCommands(cliContent);
  const flags = extractFlags(cliContent);
  const exitCodes = extractExitCodes();
  
  const snapshot = {
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    commands: {
      count: commands.length,
      list: commands
    },
    flags: {
      global: ['--json', '--help', '-h', '--version', '-v', '--minimal'],
      all: flags
    },
    exitCodes: exitCodes,
    helpText: {
      structure: 'standard',
      sections: ['CORE COMMANDS', 'GOVERNANCE COMMANDS', 'INSPECTION COMMANDS', 'MICROFRACTURE SUITE', 'ENTERPRISE COMMANDS', 'ADMIN COMMANDS', 'OPTIONS', 'EXAMPLES']
    }
  };
  
  // Save snapshot
  try {
    mkdirSync(join(rootDir, 'snapshots'), { recursive: true });
  } catch {}
  
  const snapshotPath = join(rootDir, 'snapshots/cli-surface.json');
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  
  console.log(`Commands: ${commands.length}`);
  console.log(`Global Flags: ${snapshot.flags.global.length}`);
  console.log(`All Flags: ${flags.length}`);
  console.log(`Exit Codes: ${Object.keys(exitCodes).length}`);
  console.log(`\nSnapshot saved to: ${snapshotPath}`);
  
  // Print command categories
  console.log('\n=== Commands by Category ===\n');
  
  const categories = {
    'Core': ['run', 'verify', 'replay', 'fingerprint', 'ui', 'quickstart'],
    'Governance': ['learn', 'realign', 'pivot', 'rollback', 'symmetry', 'economics'],
    'Inspection': ['tool', 'trace', 'stats', 'status', 'telemetry'],
    'Microfracture': ['diff', 'lineage', 'simulate', 'drift', 'explain', 'usage', 'tenant-check', 'chaos', 'share'],
    'Enterprise': ['decide', 'junctions', 'agent', 'ai'],
    'Admin': ['backup', 'restore', 'import', 'nuke', 'init', 'doctor', 'bugreport', 'fast-start', 'bench']
  };
  
  for (const [category, cmds] of Object.entries(categories)) {
    const present = cmds.filter(c => commands.includes(c));
    console.log(`${category}: ${present.join(', ')}`);
  }
  
  console.log('\n✅ CLI surface snapshot created successfully');
}

main();
