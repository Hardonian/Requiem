#!/usr/bin/env node
/**
 * CI Circular Dependency Gate
 * 
 * Fails the build if circular dependencies are detected.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const cliSrcDir = join(rootDir, 'packages/cli/src');

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
  const importRegex = /from\s+['"]([^'"]+)['"];?/g;
  const match = content.matchAll(importRegex);
  
  for (const m of match) {
    const importPath = m[1];
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = dirname(filePath);
      let resolvedPath = join(currentDir, importPath);
      if (resolvedPath.endsWith('.js')) {
        resolvedPath = resolvedPath.slice(0, -3);
      }
      
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

function main() {
  console.log('=== CI Circular Dependency Check ===\n');
  
  getAllTsFiles(cliSrcDir);
  
  for (const file of fileList) {
    const content = readFileSync(join(cliSrcDir, file), 'utf-8');
    const imports = extractImports(content, file);
    importGraph.set(file, imports);
  }
  
  const cycles = findCycles();
  
  if (cycles.length === 0) {
    console.log('✅ No circular dependencies detected - CI PASS');
    process.exit(0);
  } else {
    console.log(`❌ Found ${cycles.length} circular dependency chains - CI FAIL\n`);
    for (let i = 0; i < cycles.length; i++) {
      console.log(`Cycle ${i + 1}:`);
      console.log('  ' + cycles[i].join(' ->\n  '));
      console.log();
    }
    process.exit(1);
  }
}

main();
