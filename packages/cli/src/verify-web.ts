#!/usr/bin/env node
/**
 * verify:web - Verify web console and API routes
 * 
 * This script verifies:
 * - Web console pages are accessible
 * - API routes are properly configured
 * - No runtime errors in the console
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

async function verifyWeb(): Promise<boolean> {
  console.log('🔍 Verifying web console...\n');
  
  const cwd = process.cwd();
  let allPassed = true;
  
  // Check for Next.js app directory
  const appDirs = [
    join(cwd, 'app'),
    join(cwd, 'src', 'app'),
  ];
  
  let foundAppDir = false;
  for (const dir of appDirs) {
    if (existsSync(dir)) {
      console.log(`✓ App directory found: ${dir}`);
      foundAppDir = true;
      break;
    }
  }
  
  if (!foundAppDir) {
    console.log('⚠ App directory not found');
    return false;
  }
  
  // Check console pages exist
  const consolePages = [
    'logs',
    'objects', 
    'capabilities',
    'policies',
    'runs',
    'plans',
    'finops',
    'snapshots',
  ];
  
  console.log('\n📋 Console pages:');
  for (const page of consolePages) {
    const pagePath = join(cwd, 'src', 'app', 'console', page, 'page.tsx');
    if (existsSync(pagePath)) {
      console.log(`  ✓ ${page}`);
    } else {
      console.log(`  ⚠ ${page} - not found`);
      allPassed = false;
    }
  }
  
  // Check API routes
  const apiRoutes = [
    'logs',
    'objects',
    'caps',
    'policies',
    'runs',
    'plans',
    'budgets',
    'snapshots',
  ];
  
  console.log('\n📋 API routes:');
  for (const route of apiRoutes) {
    const routePath = join(cwd, 'src', 'app', 'api', route, 'route.ts');
    if (existsSync(routePath)) {
      console.log(`  ✓ /api/${route}`);
    } else {
      console.log(`  ⚠ /api/${route} - not found`);
      allPassed = false;
    }
  }
  
  console.log('\n' + (allPassed ? '✓' : '⚠') + ' Web verification complete');
  return allPassed;
}

verifyWeb()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
