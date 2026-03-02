#!/usr/bin/env node
/**
 * SECTION 4 — DEAD CODE ELIMINATION (REAL, NOT VIBES)
 * 
 * Detects and reports:
 * - Unused exports/modules
 * - Orphaned files not imported
 * - Duplicate utilities
 * 
 * CI gate: fails if unused exports exceed threshold
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';

interface DeadCodeReport {
  timestamp: string;
  unusedExports: string[];
  orphanedFiles: string[];
  duplicateUtilities: Array<{ name: string; locations: string[] }>;
  stats: {
    totalFiles: number;
    totalExports: number;
    unusedExportCount: number;
    orphanedFileCount: number;
    duplicateCount: number;
  };
}

// Files/directories to exclude from analysis
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /test/,
  /spec/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /scripts\//,
  /e2e\//,
];

function shouldExclude(path: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(path));
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const path = join(dir, entry.name);
      
      if (shouldExclude(path)) continue;
      
      if (entry.isDirectory()) {
        files.push(...findTypeScriptFiles(path));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(path);
      }
    }
  } catch (e) {
    // Directory may not exist
  }
  
  return files;
}

function extractExports(content: string, filePath: string): Array<{ name: string; type: string }> {
  const exports: Array<{ name: string; type: string }> = [];
  
  // Match export function/class/const/let/var
  const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }
  
  // Match export { a, b, c }
  const groupedExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = groupedExportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' ')[0]).filter(Boolean);
    for (const name of names) {
      exports.push({ name, type: 'grouped' });
    }
  }
  
  // Match export default
  const defaultExportRegex = /export\s+default\s+(?:class|function)?\s*(\w+)?/g;
  while ((match = defaultExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1] || 'default', type: 'default' });
  }
  
  // Match export * from
  const starExportRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = starExportRegex.exec(content)) !== null) {
    exports.push({ name: `* from ${match[1]}`, type: 'star' });
  }
  
  return exports;
}

function findImportsInFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  
  // Match import { a, b } from './module'
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' ')[0]).filter(Boolean);
    imports.push(...names);
  }
  
  // Match import * as name from './module'
  const namespaceImportRegex = /import\s*\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namespaceImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match import name from './module'
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match import './module' (side effect)
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

function findUnusedExports(files: string[]): string[] {
  const allExports = new Map<string, string>(); // name -> file
  const allImports = new Set<string>();
  const exportLocations = new Map<string, string>();
  
  // Collect all exports
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const exports = extractExports(content, file);
    
    for (const exp of exports) {
      if (exp.type !== 'star') {
        const key = `${exp.name}:${file}`;
        allExports.set(key, file);
        exportLocations.set(exp.name, file);
      }
    }
  }
  
  // Collect all imports
  for (const file of files) {
    const imports = findImportsInFile(file);
    for (const imp of imports) {
      allImports.add(imp);
    }
  }
  
  // Find unused
  const unused: string[] = [];
  for (const [key, file] of allExports.entries()) {
    const name = key.split(':')[0];
    // Skip if name starts with _ (intentionally private)
    if (name.startsWith('_')) continue;
    // Skip if imported anywhere
    if (!allImports.has(name)) {
      unused.push(`${file} -> ${name}`);
    }
  }
  
  return unused;
}

function findOrphanedFiles(files: string[]): string[] {
  const orphaned: string[] = [];
  const fileSet = new Set(files.map(f => f.replace(/\\/g, '/')));
  
  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, '/');
    const content = readFileSync(file, 'utf-8');
    
    // Check if this file is imported anywhere
    let isImported = false;
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    let match;
    
    // Check if any other file imports this one
    for (const otherFile of files) {
      if (otherFile === file) continue;
      const otherContent = readFileSync(otherFile, 'utf-8');
      
      // Extract the relative path that would import this file
      const relativePath = relative(dirname(otherFile), file);
      const normalizedRelative = relativePath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
      const importPaths = [
        normalizedRelative,
        `./${normalizedRelative}`,
        normalizedRelative.replace(/\/index$/, ''),
        `./${normalizedRelative.replace(/\/index$/, '')}`,
      ];
      
      for (const importPath of importPaths) {
        if (otherContent.includes(`'${importPath}'`) || otherContent.includes(`"${importPath}"`)) {
          isImported = true;
          break;
        }
      }
      
      if (isImported) break;
    }
    
    // Skip index files and main entry points
    const fileName = basename(file);
    if (fileName === 'index.ts' || fileName === 'index.tsx' || fileName === 'cli.ts') {
      continue;
    }
    
    if (!isImported) {
      orphaned.push(file);
    }
  }
  
  return orphaned;
}

function findDuplicateUtilities(files: string[]): Array<{ name: string; locations: string[] }> {
  const utilityPatterns = [
    { regex: /function\s+((?:is|has|can|should|get|set|format|parse|validate|sanitize)\w+)\s*\(/g, type: 'function' },
    { regex: /const\s+((?:is|has|can|should|get|set|format|parse|validate|sanitize)\w+)\s*[=:]/g, type: 'const' },
  ];
  
  const utilities = new Map<string, string[]>();
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    
    for (const pattern of utilityPatterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const name = match[1];
        if (!utilities.has(name)) {
          utilities.set(name, []);
        }
        utilities.get(name)!.push(file);
      }
    }
  }
  
  // Find duplicates (same name in multiple files)
  const duplicates: Array<{ name: string; locations: string[] }> = [];
  for (const [name, locations] of utilities.entries()) {
    if (locations.length > 1) {
      duplicates.push({ name, locations });
    }
  }
  
  return duplicates;
}

async function main() {
  console.log('=== DEAD CODE ELIMINATION ANALYSIS ===\n');
  
  // Thresholds for CI gating
  const UNUSED_EXPORT_THRESHOLD = 20;
  const ORPHANED_FILE_THRESHOLD = 5;
  const DUPLICATE_THRESHOLD = 10;
  
  // Find all TypeScript files
  const packagesFiles = findTypeScriptFiles('packages/cli/src');
  const readyLayerFiles = findTypeScriptFiles('ready-layer/src');
  const allFiles = [...packagesFiles, ...readyLayerFiles];
  
  console.log(`Analyzing ${allFiles.length} files...\n`);
  
  // Run analysis
  console.log('1. Finding unused exports...');
  const unusedExports = findUnusedExports(allFiles);
  console.log(`   Found ${unusedExports.length} unused exports`);
  if (unusedExports.length > 0) {
    unusedExports.slice(0, 10).forEach(e => console.log(`     - ${e}`));
    if (unusedExports.length > 10) console.log(`     ... and ${unusedExports.length - 10} more`);
  }
  
  console.log('\n2. Finding orphaned files...');
  const orphanedFiles = findOrphanedFiles(allFiles);
  console.log(`   Found ${orphanedFiles.length} potentially orphaned files`);
  if (orphanedFiles.length > 0) {
    orphanedFiles.slice(0, 10).forEach(f => console.log(`     - ${f}`));
    if (orphanedFiles.length > 10) console.log(`     ... and ${orphanedFiles.length - 10} more`);
  }
  
  console.log('\n3. Finding duplicate utilities...');
  const duplicates = findDuplicateUtilities(allFiles);
  console.log(`   Found ${duplicates.length} potentially duplicate utilities`);
  if (duplicates.length > 0) {
    duplicates.slice(0, 5).forEach(d => {
      console.log(`     - ${d.name}: ${d.locations.length} locations`);
    });
    if (duplicates.length > 5) console.log(`     ... and ${duplicates.length - 5} more`);
  }
  
  // Generate report
  const report: DeadCodeReport = {
    timestamp: new Date().toISOString(),
    unusedExports,
    orphanedFiles,
    duplicateUtilities: duplicates,
    stats: {
      totalFiles: allFiles.length,
      totalExports: unusedExports.length, // Approximation
      unusedExportCount: unusedExports.length,
      orphanedFileCount: orphanedFiles.length,
      duplicateCount: duplicates.length,
    },
  };
  
  // Save report
  if (!existsSync('reports')) {
    require('fs').mkdirSync('reports', { recursive: true });
  }
  writeFileSync('reports/dead-code-analysis.json', JSON.stringify(report, null, 2));
  console.log('\n✓ Report saved to reports/dead-code-analysis.json');
  
  // CI gate check
  console.log('\n=== CI GATE CHECK ===');
  let failed = false;
  
  if (unusedExports.length > UNUSED_EXPORT_THRESHOLD) {
    console.log(`✗ Unused exports (${unusedExports.length}) exceeds threshold (${UNUSED_EXPORT_THRESHOLD})`);
    failed = true;
  } else {
    console.log(`✓ Unused exports (${unusedExports.length}) within threshold (${UNUSED_EXPORT_THRESHOLD})`);
  }
  
  if (orphanedFiles.length > ORPHANED_FILE_THRESHOLD) {
    console.log(`✗ Orphaned files (${orphanedFiles.length}) exceeds threshold (${ORPHANED_FILE_THRESHOLD})`);
    failed = true;
  } else {
    console.log(`✓ Orphaned files (${orphanedFiles.length}) within threshold (${ORPHANED_FILE_THRESHOLD})`);
  }
  
  if (duplicates.length > DUPLICATE_THRESHOLD) {
    console.log(`✗ Duplicates (${duplicates.length}) exceeds threshold (${DUPLICATE_THRESHOLD})`);
    failed = true;
  } else {
    console.log(`✓ Duplicates (${duplicates.length}) within threshold (${DUPLICATE_THRESHOLD})`);
  }
  
  if (failed) {
    console.log('\n✗ Dead code analysis FAILED - thresholds exceeded');
    process.exit(1);
  } else {
    console.log('\n✓ Dead code analysis PASSED');
    process.exit(0);
  }
}

main().catch(console.error);
