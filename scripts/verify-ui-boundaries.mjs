#!/usr/bin/env node
/**
 * Verify UI Package Boundaries
 * 
 * Checks that the UI package doesn't have circular dependencies
 * and that all imports are valid.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UI_SRC_DIR = join(__dirname, '../packages/ui/src');

const errors = [];
const warnings = [];

/**
 * Get all TypeScript/TSX files in a directory
 */
function getTsFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getTsFiles(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(item) && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Parse imports from a file
 */
function parseImports(content) {
  const imports = [];
  
  // Match import statements
  const importRegex = /import\s+(?:(?:{[^}]*}|[^'"]*)\s+from\s+)?['"]([^'"]+)['"];?/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Check if an import is valid within the UI package
 */
function validateImport(importPath, sourceFile) {
  // External imports (node_modules) - always valid
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return { valid: true };
  }
  
  // Absolute imports from root
  if (importPath.startsWith('/')) {
    return { valid: true };
  }
  
  // Relative imports
  const sourceDir = dirname(sourceFile);
  const resolvedPath = join(sourceDir, importPath);
  
  // Check for parent directory imports (../) that go outside src
  const relativeToSrc = relative(UI_SRC_DIR, resolvedPath);
  
  if (relativeToSrc.startsWith('..')) {
    return {
      valid: false,
      error: `Import escapes UI src directory: ${importPath}`,
    };
  }
  
  // Check for circular dependencies would require full graph analysis
  // For now, we just validate the path format
  
  return { valid: true };
}

/**
 * Main verification function
 */
function verifyBoundaries() {
  console.log('Verifying UI package boundaries...\n');
  
  const files = getTsFiles(UI_SRC_DIR);
  console.log(`Found ${files.length} TypeScript files\n`);
  
  const dependencyGraph = new Map();
  
  for (const file of files) {
    const relativePath = relative(UI_SRC_DIR, file);
    const content = readFileSync(file, 'utf-8');
    const imports = parseImports(content);
    
    dependencyGraph.set(relativePath, []);
    
    for (const importPath of imports) {
      const validation = validateImport(importPath, file);
      
      if (!validation.valid) {
        errors.push({
          file: relativePath,
          import: importPath,
          error: validation.error,
        });
      }
      
      // Track internal dependencies for circular check
      if (importPath.startsWith('.')) {
        const sourceDir = dirname(file);
        const resolvedPath = join(sourceDir, importPath);
        const relativeImport = relative(UI_SRC_DIR, resolvedPath);
        
        if (!relativeImport.startsWith('..')) {
          dependencyGraph.get(relativePath).push(relativeImport);
        }
      }
    }
  }
  
  // Check for circular dependencies
  const visited = new Set();
  const recursionStack = new Set();
  
  function hasCycle(node, path = []) {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      return cycle;
    }
    
    if (visited.has(node)) {
      return null;
    }
    
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const deps = dependencyGraph.get(node) || [];
    for (const dep of deps) {
      const cycle = hasCycle(dep + '.tsx', path);
      if (cycle) return cycle;
    }
    
    path.pop();
    recursionStack.delete(node);
    return null;
  }
  
  for (const [file] of dependencyGraph) {
    const cycle = hasCycle(file);
    if (cycle) {
      errors.push({
        file: cycle[0],
        error: `Circular dependency detected: ${cycle.join(' -> ')}`,
      });
    }
  }
  
  // Report results
  console.log('=== Verification Results ===\n');
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ All checks passed!\n');
    return 0;
  }
  
  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):\n`);
    for (const warning of warnings) {
      console.log(`  ⚠ ${warning.file}:`);
      console.log(`    ${warning.warning}\n`);
    }
  }
  
  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):\n`);
    for (const error of errors) {
      console.log(`  ✗ ${error.file}:`);
      console.log(`    ${error.error}\n`);
    }
    return 1;
  }
  
  return 0;
}

// Run verification
const exitCode = verifyBoundaries();
process.exit(exitCode);
