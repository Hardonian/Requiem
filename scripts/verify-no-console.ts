#!/usr/bin/env node
/**
 * Verify no console.* usage in production code paths
 * 
 * INVARIANT: No console.log/error/warn/info in production code.
 * Allowed: console.* in tests, scripts, and explicitly whitelisted files.
 */

import * as fs from 'fs';
import * as path from 'path';

// Files/directories that are allowed to use console.*
const WHITELIST = new Set([
  // Test files
  '.test.ts',
  '.spec.ts',
  '__tests__',
  
  // Scripts that run outside CLI
  'scripts/',
  
  // This file itself
  'verify-no-console.ts',
  
  // Build/dev scripts
  'vite.config.',
  'next.config.',
  'webpack.config.',
  
  // CLI entry point allowed for stdout writes (not logs)
  // But we still want to catch console.* there
]);

// Files with explicit permission to use console (documented reason required)
const EXCEPTIONS = new Map<string, string>([
  ['cli.ts', 'CLI entry point - user-facing output via stdout.write (not console.log)'],
]);

interface Violation {
  file: string;
  line: number;
  code: string;
  method: string;
}

function shouldCheckFile(filePath: string): boolean {
  // Skip node_modules, dist, etc.
  if (filePath.includes('node_modules') || 
      filePath.includes('dist/') || 
      filePath.includes('.next/') ||
      filePath.includes('build/')) {
    return false;
  }
  
  // Skip declaration files
  if (filePath.endsWith('.d.ts')) return false;
  
  // Skip whitelisted paths
  for (const white of WHITELIST) {
    if (filePath.includes(white)) return false;
  }
  
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

function findViolations(dir: string): Violation[] {
  const violations: Violation[] = [];
  
  function scan(directory: string) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (shouldCheckFile(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Match console.log, console.error, console.warn, console.info
          // But not console.* in comments or strings
          const match = line.match(/console\.(log|error|warn|info|debug)\s*\(/);
          if (match && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            // Check if it's inside a string (simple heuristic)
            const beforeMatch = line.substring(0, line.indexOf('console'));
            const quotes = (beforeMatch.match(/["'`]/g) || []).length;
            if (quotes % 2 === 0) { // Not inside a string
              violations.push({
                file: fullPath,
                line: i + 1,
                code: line.trim(),
                method: match[1],
              });
            }
          }
        }
      }
    }
  }
  
  scan(dir);
  return violations;
}

function main(): number {
  const targetDir = process.argv[2] || 'packages/cli/src';
  
  console.log(`🔍 Scanning ${targetDir} for console.* usage...\n`);
  
  const violations = findViolations(targetDir);
  
  if (violations.length === 0) {
    console.log('✅ No console.* violations found in production code.');
    return 0;
  }
  
  console.log(`❌ Found ${violations.length} console.* usage violation(s):\n`);
  
  // Group by file
  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = byFile.get(v.file) || [];
    list.push(v);
    byFile.set(v.file, list);
  }
  
  for (const [file, vs] of byFile) {
    console.log(`  ${file}`);
    for (const v of vs) {
      console.log(`    Line ${v.line}: ${v.code.substring(0, 60)}`);
    }
    console.log();
  }
  
  console.log('Fix: Replace console.* with logger.* from core/logging.ts');
  console.log('Example:');
  console.log('  ❌ console.log("message")');
  console.log('  ✅ logger.info("event_name", "message", { fields })');
  
  return 1;
}

process.exit(main());
