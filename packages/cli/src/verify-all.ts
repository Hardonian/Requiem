#!/usr/bin/env node
/**
 * verify:all - Run all verification scripts
 * 
 * This script runs:
 * - verify:boundaries
 * - verify:integrity
 * - verify:policy
 * - verify:replay
 * - verify:web
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const verifyScripts = [
  { name: 'boundaries', path: './src/verify-boundaries.ts' },
  { name: 'integrity', path: './src/verify-integrity.ts' },
  { name: 'policy', path: './src/verify-policy.ts' },
  { name: 'replay', path: './src/verify-replay.ts' },
  { name: 'web', path: './src/verify-web.ts' },
];

async function runAllVerifies(): Promise<boolean> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    REQUIEM VERIFY SUITE                       ');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let allPassed = true;
  const results: Array<{ name: string; passed: boolean }> = [];
  
  for (const script of verifyScripts) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Running verify:${script.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
      // Check if script exists
      if (!existsSync(join(process.cwd(), script.path))) {
        console.log(`⚠ verify:${script.name} - script not found`);
        results.push({ name: script.name, passed: false });
        allPassed = false;
        continue;
      }
      
      // Use tsx to run the script
      execSync(`npx tsx ${script.path}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      results.push({ name: script.name, passed: true });
    } catch (err) {
      console.log(`✗ verify:${script.name} FAILED`);
      results.push({ name: script.name, passed: false });
      allPassed = false;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      VERIFICATION SUMMARY                      ');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    console.log(`  ${icon} verify:${result.name}`);
  }
  
  console.log('\n' + (allPassed ? '✓ ALL VERIFICATIONS PASSED' : '✗ SOME VERIFICATIONS FAILED'));
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  return allPassed;
}

runAllVerifies()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error running verify suite:', err);
    process.exit(1);
  });
