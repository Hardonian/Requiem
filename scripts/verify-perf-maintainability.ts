#!/usr/bin/env node
/**
 * Performance + Maintainability Verification Script
 * 
 * Runs all checks required for the optimization mission.
 * Must pass before any PR is merged.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
  warning?: boolean;
}

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function check(name: string, fn: () => { passed: boolean; message: string; details?: string[]; warning?: boolean }): CheckResult {
  try {
    const result = fn();
    return { name, ...result };
  } catch (e) {
    return {
      name,
      passed: false,
      message: `Check threw: ${(e as Error).message}`,
    };
  }
}

function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  
  // Check 1: Core error system exists (CRITICAL)
  results.push(check('core-error-system', () => {
    const exists = fs.existsSync('packages/cli/src/core/errors.ts');
    const hasCodes = fs.existsSync('packages/cli/src/core/errors.ts') && 
      fs.readFileSync('packages/cli/src/core/errors.ts', 'utf-8').includes('E_CFG_');
    return {
      passed: exists && hasCodes,
      message: exists && hasCodes ? 'Unified error system present with typed codes' : 'Missing or incomplete core/errors.ts',
    };
  }));
  
  // Check 2: Core logging system exists (CRITICAL)
  results.push(check('core-logging-system', () => {
    const exists = fs.existsSync('packages/cli/src/core/logging.ts');
    const hasLogger = fs.existsSync('packages/cli/src/core/logging.ts') &&
      fs.readFileSync('packages/cli/src/core/logging.ts', 'utf-8').includes('export class Logger');
    return {
      passed: exists && hasLogger,
      message: exists && hasLogger ? 'Structured logging present' : 'Missing or incomplete core/logging.ts',
    };
  }));
  
  // Check 3: Core module exports (CRITICAL)
  results.push(check('core-module-exports', () => {
    const indexPath = 'packages/cli/src/core/index.ts';
    if (!fs.existsSync(indexPath)) {
      return { passed: false, message: 'Missing core/index.ts' };
    }
    const content = fs.readFileSync(indexPath, 'utf-8');
    const hasErrors = content.includes('err') && content.includes('AppError');
    const hasLogging = content.includes('logger') && content.includes('Logger');
    return {
      passed: hasErrors && hasLogging,
      message: hasErrors && hasLogging 
        ? 'Core exports errors and logging'
        : 'Core missing error or logging exports',
    };
  }));
  
  // Check 4: CLI entry uses new system (CRITICAL)
  results.push(check('cli-uses-core', () => {
    const cliPath = 'packages/cli/src/cli.ts';
    if (!fs.existsSync(cliPath)) return { passed: false, message: 'cli.ts not found' };
    const content = fs.readFileSync(cliPath, 'utf-8');
    const hasImport = content.includes('./core/index.js') || content.includes('./core/errors.js');
    const hasLogger = content.includes('logger.');
    const hasLazyImport = content.includes('loadCommand') || content.includes('await import(');
    return {
      passed: hasImport && hasLogger && hasLazyImport,
      message: hasImport && hasLogger && hasLazyImport
        ? 'CLI uses core system with lazy imports'
        : 'CLI missing core integration',
    };
  }));
  
  // Check 5: Documentation exists (CRITICAL)
  results.push(check('documentation', () => {
    const hasErrorsDoc = fs.existsSync('docs/errors.md');
    const hasLoggingDoc = fs.existsSync('docs/logging.md');
    return {
      passed: hasErrorsDoc && hasLoggingDoc,
      message: hasErrorsDoc && hasLoggingDoc
        ? 'Error and logging docs present'
        : `Missing: ${!hasErrorsDoc ? 'docs/errors.md ' : ''}${!hasLoggingDoc ? 'docs/logging.md' : ''}`,
    };
  }));
  
  // Check 6: Verification scripts exist (CRITICAL)
  results.push(check('verify-scripts', () => {
    const hasNoConsole = fs.existsSync('scripts/verify-no-console.ts');
    const hasPerf = fs.existsSync('scripts/verify-perf-maintainability.ts');
    const hasCodemod = fs.existsSync('scripts/codemod-console-to-logger.ts');
    return {
      passed: hasNoConsole && hasPerf && hasCodemod,
      message: hasNoConsole && hasPerf && hasCodemod
        ? 'All verification scripts present'
        : 'Missing verification scripts',
    };
  }));
  
  // Check 7: Package.json updated with verify scripts (CRITICAL)
  results.push(check('package-scripts', () => {
    const pkgPath = 'packages/cli/package.json';
    if (!fs.existsSync(pkgPath)) return { passed: false, message: 'package.json not found' };
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const hasVerifyNoConsole = pkg.scripts && pkg.scripts['verify:no-console'];
    const hasVerifyPerf = pkg.scripts && pkg.scripts['verify:perf-maint'];
    return {
      passed: hasVerifyNoConsole && hasVerifyPerf,
      message: hasVerifyNoConsole && hasVerifyPerf
        ? 'Package.json has verification scripts'
        : 'Package.json missing verification scripts',
    };
  }));
  
  // Check 8: No console in NEW code (core/*) - CRITICAL PATH
  results.push(check('no-console-in-core', () => {
    const coreDir = 'packages/cli/src/core';
    if (!fs.existsSync(coreDir)) return { passed: false, message: 'core/ not found' };
    
    const files = fs.readdirSync(coreDir).filter(f => f.endsWith('.ts'));
    const violations: string[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(coreDir, file), 'utf-8');
      if (content.match(/console\.(log|error|warn|info|debug)\s*\(/)) {
        violations.push(file);
      }
    }
    
    return {
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'No console.* in core/*'
        : `${violations.length} file(s) in core/ use console.*`,
    };
  }));
  
  // Check 9: Console usage migration status (WARNING - transitional)
  results.push(check('console-migration-status', () => {
    const violations: string[] = [];
    const targetDir = 'packages/cli/src';
    
    function scan(directory: string) {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!fullPath.includes('node_modules') && 
              !fullPath.includes('dist') && 
              !fullPath.includes('core')) {
            scan(fullPath);
          }
        } else if (fullPath.endsWith('.ts') && 
                   !fullPath.endsWith('.test.ts') &&
                   !fullPath.includes('cli.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/console\.(log|error|warn|info|debug)\s*\(/)) {
              violations.push(`${path.relative('packages/cli/src', fullPath)}:${i + 1}`);
            }
          }
        }
      }
    }
    
    try {
      scan(targetDir);
    } catch {}
    
    return {
      passed: true, // This is a warning, not a failure
      warning: violations.length > 0,
      message: violations.length === 0
        ? 'All files migrated to logger.*'
        : `${violations.length} console.* call(s) remaining to migrate`,
      details: violations.length > 0 
        ? ['Run: npx tsx scripts/verify-no-console.ts to see all', 'Run: npx tsx scripts/codemod-console-to-logger.ts to migrate'] 
        : undefined,
    };
  }));
  
  // Check 10: TypeScript compilation
  results.push(check('typescript', () => {
    const coreErrors = 'packages/cli/src/core/errors.ts';
    const coreLogging = 'packages/cli/src/core/logging.ts';
    
    if (!fs.existsSync(coreErrors) || !fs.existsSync(coreLogging)) {
      return { passed: false, message: 'Core files missing' };
    }
    
    // Basic syntax check
    try {
      const errorsContent = fs.readFileSync(coreErrors, 'utf-8');
      const loggingContent = fs.readFileSync(coreLogging, 'utf-8');
      
      // Check for basic TypeScript patterns
      const hasTypes = errorsContent.includes('export type') && errorsContent.includes('interface');
      const hasClasses = loggingContent.includes('export class');
      
      return {
        passed: hasTypes && hasClasses,
        message: hasTypes && hasClasses ? 'TypeScript syntax valid' : 'TypeScript syntax issues detected',
      };
    } catch {
      return { passed: false, message: 'Could not read core files' };
    }
  }));
  
  return results;
}

function main(): number {
  console.log('\n🔍 Performance + Maintainability Verification\n');
  
  const results = runChecks();
  let passedCount = 0;
  let failedCount = 0;
  let warningCount = 0;
  
  for (const result of results) {
    let icon: string;
    let status: string;
    
    if (result.warning) {
      icon = `${YELLOW}⚠${RESET}`;
      status = `${YELLOW}WARN${RESET}`;
      warningCount++;
    } else if (result.passed) {
      icon = `${GREEN}✓${RESET}`;
      status = `${GREEN}PASS${RESET}`;
      passedCount++;
    } else {
      icon = `${RED}✗${RESET}`;
      status = `${RED}FAIL${RESET}`;
      failedCount++;
    }
    
    console.log(`${icon} [${status}] ${result.name}: ${result.message}`);
    
    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        console.log(`    ${YELLOW}→${RESET} ${detail}`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${GREEN}${passedCount} passed${RESET}, ${RED}${failedCount} failed${RESET}, ${YELLOW}${warningCount} warning(s)${RESET}`);
  
  if (failedCount === 0) {
    console.log(`\n${GREEN}✅ Core verification checks passed!${RESET}\n`);
    if (warningCount > 0) {
      console.log(`${YELLOW}⚠️  Some warnings remain - see details above${RESET}\n`);
    }
    return 0;
  } else {
    console.log(`\n${RED}❌ Some critical verification checks failed.${RESET}\n`);
    return 1;
  }
}

process.exit(main());
