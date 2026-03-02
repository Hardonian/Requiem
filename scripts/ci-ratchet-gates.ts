#!/usr/bin/env node
/**
 * CI Ratchet Gates - Comprehensive Quality Gates
 *
 * Implements ratcheting for:
 * 1. Bundle Size Gate: Fail if bundle size increases > 5% from baseline
 * 2. Cold Start Gate: Fail if cold start increases > 50ms from baseline
 * 3. Unused Exports Gate: Fail if unused exports increase from baseline
 * 4. Console Detection Gate: Fail if console.* found in production code
 * 5. Circular Dependency Gate: Fail if circular dependencies detected
 * 6. Public Surface Gate: Fail if CLI surface changes without version bump
 *
 * Exit codes:
 * - 0: All gates passed
 * - 1: One or more gates failed
 *
 * Flags:
 * --update-baselines: Update all baseline files with current values
 * --verbose: Enable detailed logging
 * --gate=<name>: Run only specific gate
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { join, relative, resolve } from 'path';
import ts from 'typescript';

// ============================================================================
// TYPES
// ============================================================================

interface BundleBaseline {
  totalSizeBytes: number;
  totalSizeKB: number;
  fileCount: number;
  timestamp: string;
  files: Record<string, number>; // filename -> size in bytes
}

interface ColdStartBaseline {
  coldStartMs: number;
  timestamp: string;
}

interface ExportsBaseline {
  unusedExports: number;
  totalExports: number;
  unusedPercentage: number;
  timestamp: string;
  exports: Array<{
    file: string;
    name: string;
    line: number;
  }>;
}

interface ConsoleBaseline {
  violations: number;
  timestamp: string;
}

interface CircularDepBaseline {
  circularCount: number;
  timestamp: string;
  cycles: string[][];
}

interface CLISurfaceBaseline {
  version: string;
  commands: string[];
  flags: string[];
  timestamp: string;
}

interface GateResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  baseline?: unknown;
  current?: unknown;
}

interface RatchetReport {
  timestamp: string;
  commit: string;
  branch: string;
  gates: GateResult[];
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface CLIOptions {
  updateBaselines: boolean;
  verbose: boolean;
  specificGate?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RATIOS = {
  BUNDLE_SIZE_INCREASE_MAX: 0.05, // 5%
  COLD_START_INCREASE_MAX_MS: 50, // 50ms
};

const PATHS = {
  BUNDLE_BASELINE: 'reports/bundle-baseline.json',
  COLD_START_BASELINE: 'reports/cold-start-baseline.json',
  EXPORTS_BASELINE: 'reports/exports-baseline.json',
  CONSOLE_BASELINE: 'reports/console-baseline.json',
  CIRCULAR_DEP_BASELINE: 'reports/circular-dep-baseline.json',
  CLI_SURFACE_BASELINE: 'reports/cli-surface.json',
  REPORT: 'reports/ci-ratchet-report.json',
  CLI_SRC: 'packages/cli/src',
  READY_LAYER_SRC: 'ready-layer/src',
  BUNDLE_DIR: 'ready-layer/.next/static/chunks',
  CLI_PACKAGE_JSON: 'packages/cli/package.json',
};

const EXCLUDED_PATHS = [
  '.test.',
  '.spec.',
  '__tests__',
  '__mocks__',
  '/scripts/',
  '/node_modules/',
  '/dist/',
  '/build/',
  '.d.ts',
];

// ============================================================================
// LOGGING
// ============================================================================

class Logger {
  private verbose: boolean;

  constructor(verbose: boolean) {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(`ℹ ${message}`);
  }

  success(message: string): void {
    console.log(`✓ ${message}`);
  }

  error(message: string): void {
    console.log(`✗ ${message}`);
  }

  warn(message: string): void {
    console.log(`⚠ ${message}`);
  }

  verboseLog(message: string, data?: unknown): void {
    if (this.verbose) {
      console.log(`  → ${message}`);
      if (data !== undefined) {
        console.log(`    ${JSON.stringify(data, null, 2).split('\n').join('\n    ')}`);
      }
    }
  }

  section(title: string): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
  }

  gate(name: string): void {
    console.log(`\n▶ ${name}`);
  }
}

let logger: Logger;

// ============================================================================
// UTILITIES
// ============================================================================

function getGitInfo(): { commit: string; branch: string } {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    return { commit, branch };
  } catch {
    return { commit: 'unknown', branch: 'unknown' };
  }
}

function readJsonFile<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch (error) {
    logger.verboseLog(`Failed to read ${path}:`, error);
    return null;
  }
}

function writeJsonFile(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2));
  logger.verboseLog(`Wrote ${path}`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDED_PATHS.some(pattern => filePath.includes(pattern));
}

function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  function traverse(currentDir: string): void {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.includes('node_modules') && !entry.name.includes('.git')) {
          traverse(fullPath);
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        if (!shouldExcludeFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

// ============================================================================
// GATE 1: BUNDLE SIZE
// ============================================================================

async function runBundleSizeGate(updateBaselines: boolean): Promise<GateResult> {
  logger.gate('Bundle Size Gate');

  // Calculate current bundle size
  const currentSize: BundleBaseline = {
    totalSizeBytes: 0,
    totalSizeKB: 0,
    fileCount: 0,
    timestamp: new Date().toISOString(),
    files: {},
  };

  if (!existsSync(PATHS.BUNDLE_DIR)) {
    return {
      name: 'bundle-size',
      passed: false,
      message: `Bundle directory not found: ${PATHS.BUNDLE_DIR}`,
      current: currentSize,
    };
  }

  // Read all JS files in bundle directory
  const bundleFiles = findFiles(PATHS.BUNDLE_DIR, ['.js']);

  for (const file of bundleFiles) {
    const stats = statSync(file);
    const relativePath = relative(PATHS.BUNDLE_DIR, file);
    currentSize.totalSizeBytes += stats.size;
    currentSize.files[relativePath] = stats.size;
  }

  currentSize.fileCount = bundleFiles.length;
  currentSize.totalSizeKB = Math.round((currentSize.totalSizeBytes / 1024) * 100) / 100;

  logger.verboseLog(`Found ${currentSize.fileCount} JS files`);
  logger.verboseLog(`Total size: ${formatBytes(currentSize.totalSizeBytes)}`);

  // Read baseline
  const baseline = readJsonFile<BundleBaseline>(PATHS.BUNDLE_BASELINE);

  // Update baseline if requested
  if (updateBaselines) {
    writeJsonFile(PATHS.BUNDLE_BASELINE, currentSize);
    return {
      name: 'bundle-size',
      passed: true,
      message: `Baseline updated: ${formatBytes(currentSize.totalSizeBytes)} (${currentSize.fileCount} files)`,
      baseline: currentSize,
      current: currentSize,
    };
  }

  // No baseline exists
  if (!baseline) {
    return {
      name: 'bundle-size',
      passed: false,
      message: `No baseline found. Run with --update-baselines to create one.`,
      current: currentSize,
    };
  }

  // Calculate change
  const sizeDiff = currentSize.totalSizeBytes - baseline.totalSizeBytes;
  const percentChange = baseline.totalSizeBytes > 0
    ? (sizeDiff / baseline.totalSizeBytes) * 100
    : 0;
  const maxAllowedIncrease = baseline.totalSizeBytes * RATIOS.BUNDLE_SIZE_INCREASE_MAX;

  logger.verboseLog(`Baseline: ${formatBytes(baseline.totalSizeBytes)}`);
  logger.verboseLog(`Current: ${formatBytes(currentSize.totalSizeBytes)}`);
  logger.verboseLog(`Change: ${sizeDiff > 0 ? '+' : ''}${formatBytes(sizeDiff)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`);
  logger.verboseLog(`Max allowed increase: ${formatBytes(maxAllowedIncrease)}`);

  // Check if passed
  const passed = sizeDiff <= maxAllowedIncrease;

  return {
    name: 'bundle-size',
    passed,
    message: passed
      ? `Bundle size OK: ${formatBytes(currentSize.totalSizeBytes)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}% from baseline)`
      : `Bundle size increased by ${formatBytes(sizeDiff)} (${percentChange.toFixed(2)}%), max allowed: ${formatBytes(maxAllowedIncrease)}`,
    baseline,
    current: currentSize,
    details: {
      sizeDiff,
      percentChange,
      maxAllowedIncrease,
      fileCountChange: currentSize.fileCount - baseline.fileCount,
    },
  };
}

// ============================================================================
// GATE 2: COLD START
// ============================================================================

async function runColdStartGate(updateBaselines: boolean): Promise<GateResult> {
  logger.gate('Cold Start Gate');

  // Measure cold start time
  const measurements: number[] = [];
  const runs = 5;

  logger.verboseLog(`Measuring cold start time (${runs} runs)...`);

  for (let i = 0; i < runs; i++) {
    try {
      const start = process.hrtime.bigint();

      // Run reach --help
      execSync('node packages/cli/dist/cli/src/cli.js --help', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      measurements.push(durationMs);
      logger.verboseLog(`Run ${i + 1}: ${durationMs.toFixed(2)}ms`);
    } catch (error) {
      // Try alternative path
      try {
        const start = process.hrtime.bigint();
        execSync('pnpm reach --help', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000,
        });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        measurements.push(durationMs);
        logger.verboseLog(`Run ${i + 1} (via pnpm): ${durationMs.toFixed(2)}ms`);
      } catch (fallbackError) {
        logger.verboseLog(`Failed to measure: ${fallbackError}`);
        return {
          name: 'cold-start',
          passed: false,
          message: 'Failed to measure cold start time - CLI not available',
        };
      }
    }
  }

  // Calculate average (excluding outliers)
  measurements.sort((a, b) => a - b);
  const trimmed = measurements.slice(1, -1); // Remove min and max
  const avgMs = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;

  const current: ColdStartBaseline = {
    coldStartMs: Math.round(avgMs * 100) / 100,
    timestamp: new Date().toISOString(),
  };

  logger.verboseLog(`Average cold start: ${current.coldStartMs.toFixed(2)}ms`);

  // Read baseline
  const baseline = readJsonFile<ColdStartBaseline>(PATHS.COLD_START_BASELINE);

  // Update baseline if requested
  if (updateBaselines) {
    writeJsonFile(PATHS.COLD_START_BASELINE, current);
    return {
      name: 'cold-start',
      passed: true,
      message: `Baseline updated: ${current.coldStartMs.toFixed(2)}ms`,
      baseline: current,
      current,
    };
  }

  // No baseline exists
  if (!baseline) {
    return {
      name: 'cold-start',
      passed: false,
      message: `No baseline found. Run with --update-baselines to create one.`,
      current,
    };
  }

  // Calculate change
  const diffMs = current.coldStartMs - baseline.coldStartMs;
  logger.verboseLog(`Baseline: ${baseline.coldStartMs.toFixed(2)}ms`);
  logger.verboseLog(`Difference: ${diffMs > 0 ? '+' : ''}${diffMs.toFixed(2)}ms`);
  logger.verboseLog(`Max allowed increase: ${RATIOS.COLD_START_INCREASE_MAX_MS}ms`);

  // Check if passed
  const passed = diffMs <= RATIOS.COLD_START_INCREASE_MAX_MS;

  return {
    name: 'cold-start',
    passed,
    message: passed
      ? `Cold start OK: ${current.coldStartMs.toFixed(2)}ms (${diffMs > 0 ? '+' : ''}${diffMs.toFixed(2)}ms from baseline)`
      : `Cold start regression: ${current.coldStartMs.toFixed(2)}ms (+${diffMs.toFixed(2)}ms), max allowed: +${RATIOS.COLD_START_INCREASE_MAX_MS}ms`,
    baseline,
    current,
    details: {
      diffMs,
      measurements,
    },
  };
}

// ============================================================================
// GATE 3: UNUSED EXPORTS
// ============================================================================

async function runUnusedExportsGate(updateBaselines: boolean): Promise<GateResult> {
  logger.gate('Unused Exports Gate');

  const unusedExports: Array<{ file: string; name: string; line: number }> = [];
  let totalExports = 0;

  // Scan both source directories
  const sourceDirs = [PATHS.CLI_SRC, PATHS.READY_LAYER_SRC];

  for (const dir of sourceDirs) {
    if (!existsSync(dir)) {
      logger.verboseLog(`Directory not found: ${dir}`);
      continue;
    }

    const tsFiles = findFiles(dir, ['.ts']);
    logger.verboseLog(`Scanning ${tsFiles.length} files in ${dir}`);

    for (const file of tsFiles) {
      const sourceFile = createSourceFile(file);
      if (!sourceFile) continue;

      // Find all exports in the file
      const exports = findExports(sourceFile);
      totalExports += exports.length;

      // Check if each export is used elsewhere
      for (const exp of exports) {
        if (!isExportUsed(exp, file, tsFiles)) {
          unusedExports.push({
            file: relative(process.cwd(), file),
            name: exp.name,
            line: exp.line,
          });
        }
      }
    }
  }

  const current: ExportsBaseline = {
    unusedExports: unusedExports.length,
    totalExports,
    unusedPercentage: totalExports > 0 ? Math.round((unusedExports.length / totalExports) * 10000) / 100 : 0,
    timestamp: new Date().toISOString(),
    exports: unusedExports.slice(0, 50), // Limit to first 50
  };

  logger.verboseLog(`Total exports: ${totalExports}`);
  logger.verboseLog(`Unused exports: ${unusedExports.length}`);
  logger.verboseLog(`Unused percentage: ${current.unusedPercentage}%`);

  // Read baseline
  const baseline = readJsonFile<ExportsBaseline>(PATHS.EXPORTS_BASELINE);

  // Update baseline if requested
  if (updateBaselines) {
    writeJsonFile(PATHS.EXPORTS_BASELINE, current);
    return {
      name: 'unused-exports',
      passed: true,
      message: `Baseline updated: ${current.unusedExports} unused exports (${current.unusedPercentage}%)`,
      baseline: current,
      current,
    };
  }

  // No baseline exists
  if (!baseline) {
    return {
      name: 'unused-exports',
      passed: false,
      message: `No baseline found. Run with --update-baselines to create one.`,
      current,
    };
  }

  // Check if passed (unused exports should not increase)
  const diff = current.unusedExports - baseline.unusedExports;
  const passed = diff <= 0;

  logger.verboseLog(`Baseline: ${baseline.unusedExports} unused exports`);
  logger.verboseLog(`Change: ${diff > 0 ? '+' : ''}${diff}`);

  return {
    name: 'unused-exports',
    passed,
    message: passed
      ? `Unused exports OK: ${current.unusedExports} (${diff < 0 ? '' : '+'}${diff} from baseline)`
      : `Unused exports increased: ${current.unusedExports} (+${diff} from baseline)`,
    baseline,
    current,
    details: {
      diff,
      newUnusedExports: unusedExports.filter(e =>
        !baseline.exports.some(be => be.file === e.file && be.name === e.name)
      ),
    },
  };
}

function createSourceFile(filePath: string): ts.SourceFile | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
  } catch {
    return null;
  }
}

interface ExportInfo {
  name: string;
  line: number;
  isDefault: boolean;
}

function findExports(sourceFile: ts.SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

  function visit(node: ts.Node): void {
    // Export declaration: export { foo, bar }
    if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const elem of clause.elements) {
          exports.push({
            name: elem.name.text,
            line: sourceFile.getLineAndCharacterOfPosition(elem.getStart()).line + 1,
            isDefault: false,
          });
        }
      }
    }

    // Exported function: export function foo() {}
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name) {
        exports.push({
          name: node.name.text,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          isDefault: node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword),
        });
      }
    }

    // Exported class: export class Foo {}
    if (ts.isClassDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name) {
        exports.push({
          name: node.name.text,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          isDefault: node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword),
        });
      }
    }

    // Exported interface: export interface Foo {}
    if (ts.isInterfaceDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      exports.push({
        name: node.name.text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        isDefault: node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword),
      });
    }

    // Exported const/let/var: export const foo = ...
    if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            name: decl.name.text,
            line: sourceFile.getLineAndCharacterOfPosition(decl.getStart()).line + 1,
            isDefault: node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword),
          });
        }
      }
    }

    // Export type: export type Foo = ...
    if (ts.isTypeAliasDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      exports.push({
        name: node.name.text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        isDefault: node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

function isExportUsed(exportInfo: ExportInfo, exportFile: string, allFiles: string[]): boolean {
  const exportName = exportInfo.name;
  const exportDir = resolve(exportFile, '..');

  for (const file of allFiles) {
    if (file === exportFile) continue;

    try {
      const content = readFileSync(file, 'utf-8');

      // Check for import of this export
      const importPattern = new RegExp(
        `import\\s+{[^}]*\\b${exportName}\\b[^}]*}\\s+from\\s+['"][^'"]*${getFileBaseName(exportFile)}['"]`,
        'i'
      );

      if (importPattern.test(content)) {
        return true;
      }

      // Check for import * as X from ...
      const namespaceImportPattern = new RegExp(
        `import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"][^'"]*${getFileBaseName(exportFile)}['"]`,
        'i'
      );

      if (namespaceImportPattern.test(content)) {
        // Check if the namespace import is used with the export name
        const namespaceMatch = content.match(new RegExp(`import\\s+\\*\\s+as\\s+(\\w+)\\s+from`, 'i'));
        if (namespaceMatch) {
          const namespaceName = namespaceMatch[1];
          const usagePattern = new RegExp(`\\b${namespaceName}\\.${exportName}\\b`);
          if (usagePattern.test(content)) {
            return true;
          }
        }
      }
    } catch {
      // Continue to next file
    }
  }

  return false;
}

function getFileBaseName(filePath: string): string {
  const base = filePath.replace(/\.(ts|tsx|js|jsx)$/, '');
  return base.split('/').pop() || base;
}

// ============================================================================
// GATE 4: CONSOLE DETECTION
// ============================================================================

async function runConsoleDetectionGate(updateBaselines: boolean): Promise<GateResult> {
  logger.gate('Console Detection Gate');

  const violations: Array<{ file: string; line: number; match: string }> = [];
  const consolePattern = /console\.(log|warn|error|info|debug|trace)\s*\(/g;

  const sourceDirs = [PATHS.CLI_SRC, PATHS.READY_LAYER_SRC];

  for (const dir of sourceDirs) {
    if (!existsSync(dir)) {
      logger.verboseLog(`Directory not found: ${dir}`);
      continue;
    }

    const files = findFiles(dir, ['.ts', '.tsx']);
    logger.verboseLog(`Scanning ${files.length} files in ${dir}`);

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          consolePattern.lastIndex = 0;

          // Skip comments
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
            continue;
          }

          const match = consolePattern.exec(line);
          if (match) {
            violations.push({
              file: relative(process.cwd(), file),
              line: i + 1,
              match: match[0],
            });
          }
        }
      } catch {
        // Continue to next file
      }
    }
  }

  const current: ConsoleBaseline = {
    violations: violations.length,
    timestamp: new Date().toISOString(),
  };

  logger.verboseLog(`Found ${violations.length} console.* usages`);

  // Read baseline
  const baseline = readJsonFile<ConsoleBaseline>(PATHS.CONSOLE_BASELINE);

  // Update baseline if requested
  if (updateBaselines) {
    writeJsonFile(PATHS.CONSOLE_BASELINE, { ...current, details: violations });
    return {
      name: 'console-detection',
      passed: true,
      message: `Baseline updated: ${violations.length} console.* usages`,
      baseline: current,
      current,
    };
  }

  // No baseline exists
  if (!baseline) {
    return {
      name: 'console-detection',
      passed: false,
      message: `No baseline found. Run with --update-baselines to create one.`,
      current,
    };
  }

  // Check if passed (violations should not increase)
  const diff = current.violations - baseline.violations;
  const passed = diff <= 0;

  logger.verboseLog(`Baseline: ${baseline.violations} violations`);
  logger.verboseLog(`Change: ${diff > 0 ? '+' : ''}${diff}`);

  return {
    name: 'console-detection',
    passed,
    message: passed
      ? `Console detection OK: ${current.violations} violations (${diff < 0 ? '' : '+'}${diff} from baseline)`
      : `Console violations increased: ${current.violations} (+${diff} from baseline)`,
    baseline,
    current,
    details: {
      diff,
      violations: violations.slice(0, 20), // Show first 20
    },
  };
}

// ============================================================================
// GATE 5: CIRCULAR DEPENDENCY
// ============================================================================

async function runCircularDepGate(updateBaselines: boolean): Promise<GateResult> {
  logger.gate('Circular Dependency Gate');

  const cycles: string[][] = [];
  const sourceDirs = [PATHS.CLI_SRC, PATHS.READY_LAYER_SRC];

  // Build dependency graph
  const graph = new Map<string, Set<string>>();
  const fileMap = new Map<string, string>(); // relative path -> full path

  for (const dir of sourceDirs) {
    if (!existsSync(dir)) {
      logger.verboseLog(`Directory not found: ${dir}`);
      continue;
    }

    const files = findFiles(dir, ['.ts']);
    logger.verboseLog(`Building dependency graph for ${files.length} files in ${dir}`);

    for (const file of files) {
      const relativePath = relative(process.cwd(), file);
      graph.set(relativePath, new Set());
      fileMap.set(relativePath, file);

      try {
        const content = readFileSync(file, 'utf-8');

        // Find all imports
        const importPattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"];?/g;
        let match;

        while ((match = importPattern.exec(content)) !== null) {
          const importPath = match[1];

          // Resolve relative imports
          if (importPath.startsWith('.')) {
            const resolvedPath = resolveImportPath(file, importPath);
            if (resolvedPath) {
              const relativeResolved = relative(process.cwd(), resolvedPath);
              if (!shouldExcludeFile(resolvedPath)) {
                graph.get(relativePath)?.add(relativeResolved);
              }
            }
          }
        }
      } catch {
        // Continue to next file
      }
    }
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  // Remove duplicate cycles
  const uniqueCycles = cycles.filter((cycle, index) => {
    const cycleKey = cycle.join(',');
    return !cycles.slice(0, index).some(c => {
      const cKey = c.join(',');
      return cKey === cycleKey || isRotation(c, cycle);
    });
  });

  const current: CircularDepBaseline = {
    circularCount: uniqueCycles.length,
    timestamp: new Date().toISOString(),
    cycles: uniqueCycles,
  };

  logger.verboseLog(`Found ${uniqueCycles.length} circular dependencies`);

  // Read baseline
  const baseline = readJsonFile<CircularDepBaseline>(PATHS.CIRCULAR_DEP_BASELINE);

  // Update baseline if requested
  if (updateBaselines) {
    writeJsonFile(PATHS.CIRCULAR_DEP_BASELINE, current);
    return {
      name: 'circular-dep',
      passed: true,
      message: `Baseline updated: ${uniqueCycles.length} circular dependencies`,
      baseline: current,
      current,
    };
  }

  // No baseline exists
  if (!baseline) {
    return {
      name: 'circular-dep',
      passed: uniqueCycles.length === 0, // Fail if any cycles found without baseline
      message: uniqueCycles.length === 0
        ? 'No circular dependencies detected'
        : `Found ${uniqueCycles.length} circular dependencies. Run with --update-baselines to create a baseline.`,
      current,
    };
  }

  // Check if passed (cycles should not increase)
  const diff = current.circularCount - baseline.circularCount;
  const passed = diff <= 0;

  logger.verboseLog(`Baseline: ${baseline.circularCount} cycles`);
  logger.verboseLog(`Change: ${diff > 0 ? '+' : ''}${diff}`);

  return {
    name: 'circular-dep',
    passed,
    message: passed
      ? `Circular deps OK: ${current.circularCount} cycles (${diff < 0 ? '' : '+'}${diff} from baseline)`
      : `Circular dependencies increased: ${current.circularCount} (+${diff} from baseline)`,
    baseline,
    current,
    details: {
      diff,
      newCycles: uniqueCycles.filter(c =>
        !baseline.cycles.some(bc => isSameCycle(bc, c))
      ),
    },
  };
}

function resolveImportPath(fromFile: string, importPath: string): string | null {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

  const fromDir = resolve(fromFile, '..');

  for (const ext of extensions) {
    const fullPath = resolve(fromDir, importPath + ext);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function isRotation(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const strA = a.join(',');
  const strB = b.join(',');
  return (strA + ',' + strA).includes(strB);
}

function isSameCycle(a: string[], b: string[]): boolean {
  return isRotation(a, b) || isRotation(a, b.reverse());
}

// ============================================================================
// GATE 6: PUBLIC SURFACE
// ============================================================================

async function runPublicSurfaceGate(updateBaselines: boolean): Promise<GateResult> {
  logger.gate('Public Surface Gate');

  // Get current CLI version
  const packageJson = readJsonFile<{ version: string }>(PATHS.CLI_PACKAGE_JSON);
  const currentVersion = packageJson?.version || '0.0.0';

  // Extract CLI surface from help
  let helpOutput = '';
  try {
    helpOutput = execSync('node packages/cli/dist/cli/src/cli.js --help', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch {
    try {
      helpOutput = execSync('pnpm reach --help', {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch {
      return {
        name: 'public-surface',
        passed: false,
        message: 'Failed to get CLI help output',
      };
    }
  }

  // Parse commands and flags from help
  const commands = extractCommands(helpOutput);
  const flags = extractFlags(helpOutput);

  logger.verboseLog(`Found ${commands.length} commands`);
  logger.verboseLog(`Found ${flags.length} flags`);

  const current: CLISurfaceBaseline = {
    version: currentVersion,
    commands,
    flags,
    timestamp: new Date().toISOString(),
  };

  // Read baseline
  const baseline = readJsonFile<CLISurfaceBaseline>(PATHS.CLI_SURFACE_BASELINE);

  // Update baseline if requested
  if (updateBaselines) {
    writeJsonFile(PATHS.CLI_SURFACE_BASELINE, current);
    return {
      name: 'public-surface',
      passed: true,
      message: `Baseline updated: v${currentVersion}, ${commands.length} commands, ${flags.length} flags`,
      baseline: current,
      current,
    };
  }

  // No baseline exists
  if (!baseline) {
    return {
      name: 'public-surface',
      passed: false,
      message: `No baseline found. Run with --update-baselines to create one.`,
      current,
    };
  }

  // Compare surfaces
  const addedCommands = commands.filter(c => !baseline.commands.includes(c));
  const removedCommands = baseline.commands.filter(c => !commands.includes(c));
  const addedFlags = flags.filter(f => !baseline.flags.includes(f));
  const removedFlags = baseline.flags.filter(f => !flags.includes(f));

  // Check if version changed
  const versionChanged = currentVersion !== baseline.version;

  // Surface changes require version bump
  const hasSurfaceChanges = addedCommands.length > 0 ||
    removedCommands.length > 0 ||
    addedFlags.length > 0 ||
    removedFlags.length > 0;

  const passed = !hasSurfaceChanges || versionChanged;

  logger.verboseLog(`Baseline version: ${baseline.version}`);
  logger.verboseLog(`Current version: ${currentVersion}`);
  logger.verboseLog(`Version changed: ${versionChanged}`);
  logger.verboseLog(`Surface changes: ${hasSurfaceChanges}`);

  if (addedCommands.length > 0) logger.verboseLog(`Added commands: ${addedCommands.join(', ')}`);
  if (removedCommands.length > 0) logger.verboseLog(`Removed commands: ${removedCommands.join(', ')}`);
  if (addedFlags.length > 0) logger.verboseLog(`Added flags: ${addedFlags.join(', ')}`);
  if (removedFlags.length > 0) logger.verboseLog(`Removed flags: ${removedFlags.join(', ')}`);

  return {
    name: 'public-surface',
    passed,
    message: passed
      ? `Public surface OK: v${currentVersion}, ${commands.length} commands, ${flags.length} flags`
      : `CLI surface changed without version bump! +${addedCommands.length}/-${removedCommands.length} commands, +${addedFlags.length}/-${removedFlags.length} flags`,
    baseline,
    current,
    details: {
      versionChanged,
      hasSurfaceChanges,
      addedCommands,
      removedCommands,
      addedFlags,
      removedFlags,
    },
  };
}

function extractCommands(helpText: string): string[] {
  const commands: string[] = [];

  // Match command patterns in help text
  const lines = helpText.split('\n');
  let inCommandsSection = false;

  for (const line of lines) {
    // Detect command sections
    if (line.includes('COMMANDS') || line.includes('Core Commands') || line.includes('USAGE')) {
      inCommandsSection = true;
      continue;
    }

    if (inCommandsSection && line.trim().startsWith('OPTIONS')) {
      inCommandsSection = false;
      continue;
    }

    // Extract commands - look for patterns like "  command " or "  command [args]"
    if (inCommandsSection) {
      const commandMatch = line.match(/^\s+([a-z-]+)(?:\s+\[|<|\s{2,}|$)/i);
      if (commandMatch) {
        const cmd = commandMatch[1].trim();
        if (cmd.length > 1 && !commands.includes(cmd)) {
          commands.push(cmd);
        }
      }
    }
  }

  return commands.sort();
}

function extractFlags(helpText: string): string[] {
  const flags: string[] = [];

  const flagPattern = /(--[a-z-]+)/g;
  let match;

  while ((match = flagPattern.exec(helpText)) !== null) {
    const flag = match[1];
    if (!flags.includes(flag)) {
      flags.push(flag);
    }
  }

  return flags.sort();
}

// ============================================================================
// MAIN
// ============================================================================

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  return {
    updateBaselines: args.includes('--update-baselines'),
    verbose: args.includes('--verbose'),
    specificGate: args.find(a => a.startsWith('--gate='))?.split('=')[1],
  };
}

async function main(): Promise<void> {
  const options = parseArgs();
  logger = new Logger(options.verbose);

  logger.section('CI RATCHET GATES');

  if (options.updateBaselines) {
    logger.info('Running in baseline update mode\n');
  }

  const gitInfo = getGitInfo();
  logger.verboseLog(`Commit: ${gitInfo.commit}`);
  logger.verboseLog(`Branch: ${gitInfo.branch}`);

  // Define all gates
  const allGates = [
    { name: 'bundle-size', fn: runBundleSizeGate },
    { name: 'cold-start', fn: runColdStartGate },
    { name: 'unused-exports', fn: runUnusedExportsGate },
    { name: 'console-detection', fn: runConsoleDetectionGate },
    { name: 'circular-dep', fn: runCircularDepGate },
    { name: 'public-surface', fn: runPublicSurfaceGate },
  ];

  // Filter gates if specific one requested
  const gatesToRun = options.specificGate
    ? allGates.filter(g => g.name === options.specificGate)
    : allGates;

  if (gatesToRun.length === 0) {
    logger.error(`Unknown gate: ${options.specificGate}`);
    process.exit(1);
  }

  // Run gates
  const results: GateResult[] = [];

  for (const gate of gatesToRun) {
    try {
      const result = await gate.fn(options.updateBaselines);
      results.push(result);

      if (result.passed) {
        logger.success(result.message);
      } else {
        logger.error(result.message);
      }
    } catch (error) {
      const failedResult: GateResult = {
        name: gate.name,
        passed: false,
        message: `Gate failed with error: ${error instanceof Error ? error.message : String(error)}`,
      };
      results.push(failedResult);
      logger.error(failedResult.message);
    }
  }

  // Generate report
  const report: RatchetReport = {
    timestamp: new Date().toISOString(),
    commit: gitInfo.commit,
    branch: gitInfo.branch,
    gates: results,
    passed: results.every(r => r.passed),
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
    },
  };

  writeJsonFile(PATHS.REPORT, report);

  // Print summary
  logger.section('SUMMARY');
  logger.info(`Total: ${report.summary.total}`);
  logger.success(`Passed: ${report.summary.passed}`);
  if (report.summary.failed > 0) {
    logger.error(`Failed: ${report.summary.failed}`);
  }

  // Exit with appropriate code
  if (report.passed) {
    logger.section('ALL GATES PASSED ✓');
    process.exit(0);
  } else {
    logger.section('SOME GATES FAILED ✗');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
