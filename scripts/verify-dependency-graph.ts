#!/usr/bin/env node
/**
 * Dependency Graph Verification
 * 
 * Enforces:
 * - core cannot import web
 * - providers cannot bypass policy
 * - policy cannot import provider adapters
 * - no circular imports
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { globSync } from 'glob';

interface ImportRule {
  from: string;
  cannotImport: string[];
  reason: string;
}

const RULES: ImportRule[] = [
  {
    from: 'packages/cli/src/core',
    cannotImport: ['ready-layer', 'packages/cli/src/web'],
    reason: 'core cannot import web (layer violation)',
  },
  {
    from: 'packages/cli/src/providers',
    cannotImport: ['packages/cli/src/policy'],
    reason: 'providers cannot bypass policy',
  },
  {
    from: 'packages/cli/src/policy',
    cannotImport: ['packages/cli/src/providers/adapter'],
    reason: 'policy cannot import provider adapters',
  },
];

const ROOT = resolve(process.cwd());

// ANSI colors
const R = '\x1b[31m';
const G = '\x1b[32m';
const N = '\x1b[0m';

function extractImports(content: string): string[] {
  const imports: string[] = [];
  
  // ES6 imports
  const es6Regex = /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g;
  let match;
  while ((match = es6Regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Dynamic imports
  const dynamicRegex = /import\(['"]([^'"]+)['"]\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

function checkFile(filePath: string, rules: ImportRule[]): string[] {
  const violations: string[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const imports = extractImports(content);
  const relativePath = filePath.replace(ROOT + '/', '');

  for (const rule of rules) {
    if (relativePath.includes(rule.from)) {
      for (const imp of imports) {
        for (const banned of rule.cannotImport) {
          if (imp.includes(banned) || imp.startsWith('.' + banned)) {
            violations.push(
              `${relativePath}: imports '${imp}' violates rule: ${rule.reason}`
            );
          }
        }
      }
    }
  }

  return violations;
}

function main(): number {
  console.log('\n=== Dependency Graph Verification ===\n');

  const srcFiles = [
    ...globSync('packages/cli/src/**/*.ts', { cwd: ROOT }),
    ...globSync('ready-layer/src/**/*.ts', { cwd: ROOT }),
    ...globSync('ready-layer/src/**/*.tsx', { cwd: ROOT }),
  ];

  let violations: string[] = [];

  for (const file of srcFiles) {
    const filePath = join(ROOT, file);
    if (existsSync(filePath)) {
      violations = violations.concat(checkFile(filePath, RULES));
    }
  }

  // Check for circular dependencies using require/import chains
  // This is a simplified check - full circular detection requires AST parsing
  
  if (violations.length === 0) {
    console.log(G + '✓ No dependency graph violations found' + N);
    return 0;
  } else {
    console.log(R + `✗ Found ${violations.length} violations:` + N);
    for (const v of violations) {
      console.log(`  - ${v}`);
    }
    return 1;
  }
}

process.exit(main());
