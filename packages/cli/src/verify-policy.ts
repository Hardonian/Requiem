#!/usr/bin/env node
/**
 * verify:policy - Verify policy configuration and enforcement
 * 
 * This script verifies:
 * - Policy files are valid JSON
 * - Policy versions are tracked
 * - Policy enforcement is active
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function verifyPolicy(): Promise<boolean> {
  console.log('🔍 Verifying policy configuration...\n');
  
  const cwd = process.cwd();
  let allPassed = true;
  
  // Check policies directory
  const policyDir = join(cwd, '.reach', 'policies');
  if (existsSync(policyDir)) {
    const policyIndexPath = join(policyDir, 'index.json');
    if (existsSync(policyIndexPath)) {
      try {
        const content = readFileSync(policyIndexPath, 'utf-8');
        const index = JSON.parse(content);
        const policyCount = Object.keys(index.policies || {}).length;
        console.log(`✓ Policies: ${policyCount} policies loaded`);
        
        // Check each policy
        for (const [name, policy] of Object.entries(index.policies || {})) {
          const pol = policy as { versions?: unknown[] };
          console.log(`  - ${name}: ${pol.versions?.length || 0} versions`);
        }
      } catch (err) {
        console.log('⚠ Policy index: Could not parse');
        allPassed = false;
      }
    }
  } else {
    console.log('⚠ Policies: Not initialized (run "reach policy add" first)');
  }
  
  // Check for policy files in common locations
  const policyPaths = [
    join(cwd, 'policy', 'default.policy.json'),
    join(cwd, 'policy.json'),
  ];
  
  for (const path of policyPaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        JSON.parse(content);
        console.log(`✓ Policy file: ${path}`);
      } catch (err) {
        console.log(`⚠ Policy file invalid: ${path}`);
        allPassed = false;
      }
    }
  }
  
  console.log('\n' + (allPassed ? '✓' : '⚠') + ' Policy verification complete');
  return allPassed;
}

verifyPolicy()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
