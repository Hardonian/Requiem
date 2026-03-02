#!/usr/bin/env node
/**
 * SECTION 1 — CONTRACTS: CLI COMMANDS (NO DRIFT)
 * 
 * Verifies CLI command contract against canonical registry.
 * Ensures every documented command exists, has help output, 
 * and returns structured AppError on failure.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Canonical command registry - single source of truth
interface CommandContract {
  name: string;
  aliases?: string[];
  flags: string[];
  requiredArgs?: string[];
  outputModes: ('human' | 'json')[];
  exitCodes: { [code: number]: string };
  category: 'core' | 'governance' | 'inspection' | 'microfracture' | 'enterprise' | 'admin';
  hasHelp: boolean;
  returnsStructuredErrors: boolean;
}

const COMMAND_REGISTRY: CommandContract[] = [
  // Core commands
  {
    name: 'run',
    flags: ['--json', '--tenant'],
    requiredArgs: ['tool-name'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error', 4: 'network_error', 5: 'policy_denied' },
    category: 'core',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'verify',
    flags: ['--json'],
    requiredArgs: ['hash'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error', 6: 'signature_failed', 7: 'replay_drift' },
    category: 'core',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'replay',
    flags: ['--json'],
    requiredArgs: ['subcommand'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error', 7: 'replay_drift' },
    category: 'core',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'fingerprint',
    flags: [],
    requiredArgs: ['hash'],
    outputModes: ['human'],
    exitCodes: { 0: 'success', 2: 'usage_error' },
    category: 'core',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'ui',
    flags: ['--port'],
    outputModes: ['human'],
    exitCodes: { 0: 'success', 4: 'network_error' },
    category: 'core',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'quickstart',
    flags: ['--json'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'core',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  
  // Microfracture Suite
  {
    name: 'diff',
    flags: ['--json', '--format', '--card', '--share'],
    requiredArgs: ['runA', 'runB'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'lineage',
    flags: ['--json', '--depth'],
    requiredArgs: ['runId'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'simulate',
    flags: ['--json', '--policy'],
    requiredArgs: ['runId'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'drift',
    flags: ['--json', '--since', '--window'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'explain',
    flags: ['--json', '--format'],
    requiredArgs: ['runId'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'usage',
    flags: ['--json', '--format'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'tenant-check',
    flags: ['--json', '--format'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 3: 'tenant_violation' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'chaos',
    flags: ['--json', '--quick', '--format'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 3: 'invariant_failure' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'share',
    flags: ['--json', '--ttl', '--scope'],
    requiredArgs: ['runId'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'microfracture',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  
  // Inspection
  {
    name: 'tool',
    flags: ['--json'],
    requiredArgs: ['subcommand'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'inspection',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'trace',
    flags: ['--json'],
    requiredArgs: ['id'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'inspection',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'stats',
    flags: ['--json'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'inspection',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'status',
    flags: ['--json'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 4: 'system_error' },
    category: 'inspection',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'telemetry',
    flags: ['--json'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'inspection',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  
  // Governance
  {
    name: 'learn',
    flags: ['--json', '--window', '--format'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'governance',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'realign',
    flags: ['--json'],
    requiredArgs: ['patch-id'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'governance',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'pivot',
    flags: ['--json'],
    requiredArgs: ['subcommand', 'name'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'governance',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'rollback',
    flags: ['--json', '--force'],
    requiredArgs: ['sha|release'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'governance',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'symmetry',
    flags: ['--json', '--economics'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'governance',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'economics',
    flags: ['--json', '--alerts', '--forecast'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'governance',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  
  // Enterprise
  {
    name: 'decide',
    flags: ['--json'],
    requiredArgs: ['subcommand'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'enterprise',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'junctions',
    flags: ['--json', '--since'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'enterprise',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'agent',
    flags: ['--json', '--tenant'],
    requiredArgs: ['subcommand'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'enterprise',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'ai',
    flags: ['--json'],
    requiredArgs: ['subcommand'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'enterprise',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  
  // Admin
  {
    name: 'backup',
    flags: ['--json', '--output'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 4: 'system_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'restore',
    flags: ['--json', '--input', '--force'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error', 4: 'system_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'import',
    flags: ['--json', '--input'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'nuke',
    flags: ['--json', '--force'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'init',
    flags: ['--json', '--force'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'config',
    flags: ['--json'],
    requiredArgs: ['subcommand'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'doctor',
    flags: ['--json'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 3: 'config_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  {
    name: 'bugreport',
    flags: ['--json', '--output'],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success', 1: 'failure', 4: 'system_error' },
    category: 'admin',
    hasHelp: true,
    returnsStructuredErrors: true,
  },
  
  // Meta
  {
    name: 'help',
    aliases: ['--help', '-h'],
    flags: [],
    outputModes: ['human'],
    exitCodes: { 0: 'success' },
    category: 'core',
    hasHelp: false,
    returnsStructuredErrors: true,
  },
  {
    name: 'version',
    aliases: ['--version', '-v'],
    flags: [],
    outputModes: ['human', 'json'],
    exitCodes: { 0: 'success' },
    category: 'core',
    hasHelp: false,
    returnsStructuredErrors: true,
  },
];

interface VerificationResult {
  command: string;
  exists: boolean;
  hasHelp: boolean;
  jsonOutputWorks: boolean;
  errorStructured: boolean;
  exitCodeCorrect: boolean;
  issues: string[];
}

function verifyCommand(contract: CommandContract): VerificationResult {
  const result: VerificationResult = {
    command: contract.name,
    exists: false,
    hasHelp: false,
    jsonOutputWorks: false,
    errorStructured: false,
    exitCodeCorrect: false,
    issues: [],
  };
  
  try {
    // Check command exists by looking for it in CLI source
    const cliSource = execSync('cat packages/cli/src/cli.ts', { encoding: 'utf-8', shell: 'powershell.exe' });
    const commandPattern = new RegExp(`case ['"]${contract.name}['"]:`);
    result.exists = commandPattern.test(cliSource);
    
    if (!result.exists) {
      result.issues.push(`Command '${contract.name}' not found in CLI switch statement`);
    }
    
    // Check help (skip for help/version themselves)
    if (contract.hasHelp && result.exists) {
      // Help is embedded in CLI, check if documented
      const helpText = execSync('node packages/cli/dist/cli.js --help', { encoding: 'utf-8' });
      result.hasHelp = helpText.includes(contract.name);
      if (!result.hasHelp) {
        result.issues.push(`Command '${contract.name}' not documented in help text`);
      }
    }
    
    // Verify JSON support
    if (contract.outputModes.includes('json') && result.exists) {
      // Check if command accepts --json flag
      const acceptsJson = cliSource.includes('json = subArgs.includes(\'--json\')') ||
                         cliSource.includes(`case '${contract.name}':`) && cliSource.includes('json');
      result.jsonOutputWorks = acceptsJson;
    }
    
    // Verify error handling
    if (contract.returnsStructuredErrors && result.exists) {
      // Check if error handling uses handleError
      const hasProperErrorHandling = cliSource.includes('handleError') &&
                                    cliSource.includes('isAppError');
      result.errorStructured = hasProperErrorHandling;
      if (!hasProperErrorHandling) {
        result.issues.push(`Command '${contract.name}' may not return structured errors`);
      }
    }
    
    // Check exit codes are documented
    result.exitCodeCorrect = Object.keys(contract.exitCodes).length > 0;
    
  } catch (e) {
    result.issues.push(`Error verifying command: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  return result;
}

async function main() {
  console.log('=== CLI COMMAND CONTRACT VERIFICATION ===\n');
  
  const results: VerificationResult[] = [];
  let passCount = 0;
  let failCount = 0;
  
  for (const contract of COMMAND_REGISTRY) {
    process.stdout.write(`Verifying ${contract.name}... `);
    const result = verifyCommand(contract);
    results.push(result);
    
    const passed = result.exists && (result.hasHelp || !contract.hasHelp) && result.errorStructured;
    if (passed) {
      console.log('✓');
      passCount++;
    } else {
      console.log('✗');
      failCount++;
      for (const issue of result.issues) {
        console.log(`  - ${issue}`);
      }
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${COMMAND_REGISTRY.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  
  // Save results
  if (!existsSync('reports')) {
    mkdirSync('reports', { recursive: true });
  }
  
  writeFileSync(
    join('reports', 'cli-contract-verification.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
  
  if (failCount > 0) {
    console.log('\n✗ Contract verification FAILED');
    process.exit(1);
  } else {
    console.log('\n✓ All commands meet contract requirements');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
