#!/usr/bin/env node
/**
 * Circular Dependency Detector
 * 
 * Detects circular imports in the CLI package and generates a report.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const cliSrcDir = join(rootDir, 'packages/cli/src');

// Map to store imports for each file
const importGraph = new Map();
const fileList = [];

function getAllTsFiles(dir, base = '') {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const relPath = join(base, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllTsFiles(fullPath, relPath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.')) {
      fileList.push(relPath);
    }
  }
}

function extractImports(content, filePath) {
  const imports = [];
  
  // Match import statements
  const importRegex = /from\s+['"]([^'"]+)['"];?/g;
  const match = content.matchAll(importRegex);
  
  for (const m of match) {
    const importPath = m[1];
    
    // Only process relative imports within the package
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Resolve the import path relative to the current file
      const currentDir = dirname(filePath);
      let resolvedPath = join(currentDir, importPath);
      
      // Normalize path (remove .js extension if present, add .ts)
      if (resolvedPath.endsWith('.js')) {
        resolvedPath = resolvedPath.slice(0, -3);
      }
      
      // Check if it's a directory index
      const possiblePaths = [
        resolvedPath + '.ts',
        join(resolvedPath, 'index.ts')
      ];
      
      for (const p of possiblePaths) {
        if (fileList.includes(p)) {
          imports.push(p);
          break;
        }
      }
    }
  }
  
  return imports;
}

function findCycles() {
  const cycles = [];
  const visited = new Set();
  const recStack = new Set();
  const path = [];
  
  function dfs(node) {
    visited.add(node);
    recStack.add(node);
    path.push(node);
    
    const neighbors = importGraph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart).concat([neighbor]);
      }
    }
    
    path.pop();
    recStack.delete(node);
    return null;
  }
  
  for (const file of fileList) {
    if (!visited.has(file)) {
      const cycle = dfs(file);
      if (cycle) {
        cycles.push(cycle);
      }
    }
  }
  
  return cycles;
}

async function main() {
  console.log('=== Circular Dependency Detection ===\n');
  
  // Get all TypeScript files
  getAllTsFiles(cliSrcDir);
  console.log(`Found ${fileList.length} TypeScript files`);
  
  // Build import graph
  for (const file of fileList) {
    const content = readFileSync(join(cliSrcDir, file), 'utf-8');
    const imports = extractImports(content, file);
    importGraph.set(file, imports);
  }
  
  // Find cycles
  const cycles = findCycles();
  
  console.log(`\nDetected ${cycles.length} circular dependency chains:\n`);
  
  for (let i = 0; i < cycles.length; i++) {
    console.log(`Cycle ${i + 1}:`);
    console.log('  ' + cycles[i].join(' ->\n  '));
    console.log();
  }
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: fileList.length,
    circularChains: cycles.length,
    cycles: cycles.map((cycle, idx) => ({
      id: idx + 1,
      files: cycle,
      length: cycle.length - 1 // Minus 1 because last is duplicate of first
    }))
  };
  
  // Save report
  try {
    mkdirSync(join(rootDir, 'reports'), { recursive: true });
  } catch {}
  writeFileSync(
    join(rootDir, 'reports/circular-deps-before.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('Report saved to: reports/circular-deps-before.json');
  
  if (cycles.length === 0) {
    console.log('✅ No circular dependencies detected!');
  } else {
    console.log(`⚠️  Found ${cycles.length} circular dependency chains that should be resolved.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


