#!/usr/bin/env node
/**
 * Codemod: Replace console.* with logger.* in production code
 * 
 * This is a migration helper to convert existing console usage.
 * Run once, then review and commit.
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_HEADER = `// MIGRATION: console.* replaced with logger.*
// See docs/logging.md for usage patterns
import { logger } from './core/logging.js';

`;

interface Replacement {
  pattern: RegExp;
  replacement: string;
}

const REPLACEMENTS: Replacement[] = [
  // console.log("message") -> logger.info("event", "message")
  {
    pattern: /console\.log\(['"`]([^'"`]+)['"`]\)/g,
    replacement: `logger.info('console.legacy', '$1')`,
  },
  // console.log("message", obj) -> logger.info("event", "message", { obj })
  {
    pattern: /console\.log\(['"`]([^'"`]+)['"`],\s*(\w+)\)/g,
    replacement: `logger.info('console.legacy', '$1', { data: $2 })`,
  },
  // console.error("message") -> logger.error("event", "message")
  {
    pattern: /console\.error\(['"`]([^'"`]+)['"`]\)/g,
    replacement: `logger.error('console.legacy', '$1')`,
  },
  // console.error("message", err) -> logger.error("event", "message", { error: err.message })
  {
    pattern: /console\.error\(['"`]([^'"`]+)['"`],\s*(\w+)\)/g,
    replacement: `logger.error('console.legacy', '$1', { error: $2 instanceof Error ? $2.message : String($2) })`,
  },
  // console.warn("message") -> logger.warn("event", "message")
  {
    pattern: /console\.warn\(['"`]([^'"`]+)['"`]\)/g,
    replacement: `logger.warn('console.legacy', '$1')`,
  },
];

function processFile(filePath: string): { changed: boolean; content: string } {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // Check if already has logger import
  const hasLoggerImport = content.includes('from\'./core/logging\'') || 
                          content.includes('from"./core/logging"') ||
                          content.includes('from\'../core/logging\'') ||
                          content.includes('from"../core/logging"');
  
  for (const { pattern, replacement } of REPLACEMENTS) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }
  
  // Add import if needed and we made changes
  if (changed && !hasLoggerImport) {
    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex >= 0) {
      const relativePath = path.relative(path.dirname(filePath), 'packages/cli/src/core').replace(/\\/g, '/');
      const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
      lines.splice(lastImportIndex + 1, 0, `import { logger } from '${importPath}/logging.js';`);
      content = lines.join('\n');
    }
  }
  
  return { changed, content };
}

function main() {
  const targetDir = process.argv[2] || 'packages/cli/src/commands';
  
  if (!fs.existsSync(targetDir)) {
    console.error(`Directory not found: ${targetDir}`);
    process.exit(1);
  }
  
  console.log(`🔧 Processing ${targetDir}...\n`);
  
  const files = fs.readdirSync(targetDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => path.join(targetDir, f));
  
  let totalChanged = 0;
  
  for (const file of files) {
    try {
      const { changed, content } = processFile(file);
      if (changed) {
        console.log(`  ✓ ${path.basename(file)}`);
        totalChanged++;
        // Uncomment to actually write:
        // fs.writeFileSync(file, content);
      }
    } catch (e) {
      console.log(`  ✗ ${path.basename(file)}: ${(e as Error).message}`);
    }
  }
  
  console.log(`\n${totalChanged} file(s) would be modified.`);
  console.log('Review changes, then uncomment the write line in the script.');
}

main();
