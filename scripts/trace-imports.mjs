#!/usr/bin/env node
/**
 * Trace heavy imports in the CLI
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Check what modules are being loaded
try {
  const loggingPath = join(rootDir, 'packages/cli/dist/cli/src/core/logging.js');
  const loggingContent = readFileSync(loggingPath, 'utf-8');
  
  // Check for imports in logging.js
  const importMatches = loggingContent.match(/from ['"]([^'"]+)['"];?/g) || [];
  console.log('=== logging.js imports ===');
  importMatches.forEach(m => console.log(' ', m));
  
  // Check errors.js
  const errorsPath = join(rootDir, 'packages/cli/dist/cli/src/core/errors.js');
  const errorsContent = readFileSync(errorsPath, 'utf-8');
  const errorImports = errorsContent.match(/from ['"]([^'"]+)['"];?/g) || [];
  console.log('\n=== errors.js imports ===');
  errorImports.forEach(m => console.log(' ', m));
  
  // Check db connection
  const dbPath = join(rootDir, 'packages/cli/dist/cli/src/db/connection.js');
  try {
    const dbContent = readFileSync(dbPath, 'utf-8');
    const dbImports = dbContent.match(/from ['"]([^'"]+)['"];?/g) || [];
    console.log('\n=== db/connection.js imports ===');
    dbImports.slice(0, 10).forEach(m => console.log(' ', m));
    if (dbImports.length > 10) {
      console.log(`  ... and ${dbImports.length - 10} more`);
    }
  } catch (e) {
    console.log('\n=== db/connection.js not found or unreadable ===');
  }
  
} catch (e) {
  console.error('Error:', e.message);
}
