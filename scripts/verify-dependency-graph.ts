#!/usr/bin/env node
/**
 * Dependency Graph Checker
 *
 * Validates architectural boundaries and detects circular dependencies
 * in the Requiem codebase.
 *
 * Rules:
 * 1. Core cannot import web: packages/cli/src cannot import from ready-layer/src
 * 2. Providers cannot bypass policy: Check that providers use policy enforcement
 * 3. Policy cannot import provider adapters: Prevent circular policy/provider deps
 * 4. No circular imports: Detect any circular dependencies in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface ImportInfo {
  source: string;
  target: string;
  importType: 'static' | 'dynamic' | 'require' | 'type-only';
  isExternal: boolean;
  line: number;
  rawImport: string;
}

interface FileNode {
  path: string;
  imports: ImportInfo[];
  importedBy: string[];
}

interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  source: string;
  target: string;
  line: number;
  suggestion: string;
}

interface DependencyGraph {
  nodes: Map<string, FileNode>;
  edges: ImportInfo[];
}

interface Report {
  timestamp: string;
  summary: {
    totalFiles: number;
    totalImports: number;
    externalImports: number;
    internalImports: number;
    violationsFound: number;
    circularDependencies: number;
  };
  violations: Violation[];
  circularPaths: string[][];
  graphStats: {
    nodes: number;
    edges: number;
    avgImportsPerFile: number;
    maxImportsInFile: number;
    maxImportsFile: string;
    disconnectedNodes: string[];
  };
  recommendedFixes: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  sourceDirs: [
    path.resolve(process.cwd(), 'packages/cli/src'),
    path.resolve(process.cwd(), 'ready-layer/src'),
  ],
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  excludePatterns: [
    /node_modules/,
    /\.d\.ts$/,
    /\.test\./,
    /\.spec\./,
    /__tests__/,
    /__mocks__/,
  ],
  rules: {
    coreCannotImportWeb: {
      enabled: true,
      from: 'packages/cli/src',
      to: 'ready-layer/src',
      message: 'Core CLI cannot import from web layer (ready-layer)',
      suggestion: 'Move shared code to a common package or use proper API boundaries',
    },
    providersMustUsePolicy: {
      enabled: true,
      providerPatterns: [/providers?\//, /adapters?\//],
      requiredImports: ['policy', 'PolicyGate', 'enforcement'],
      message: 'Providers must use policy enforcement',
      suggestion: 'Add policy gate checks before provider operations',
    },
    policyCannotImportAdapters: {
      enabled: true,
      policyPatterns: [/policy\//, /enforcement\//],
      forbiddenPatterns: [/providers?\//, /adapters?\//, /clients?\//],
      message: 'Policy layer cannot import provider adapters',
      suggestion: 'Use dependency injection or inversion of control patterns',
    },
  },
};

// ============================================================================
// Import Parsing (Optimized)
// ============================================================================

// Combined regex for better performance
const IMPORT_REGEX =
  /(?:^|[;\n])\s*(?:import\s+(?:type\s+)?(?:\*\s+as\s+\w+|\{[^}]*\}|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)?\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/gm;

const BUILT_IN_MODULES = new Set([
  'fs', 'path', 'url', 'util', 'stream', 'crypto', 'http', 'https', 'os',
  'child_process', 'events', 'buffer', 'process', 'querystring', 'readline',
  'string_decoder', 'timers', 'tls', 'tty', 'zlib', 'assert', 'async_hooks',
  'cluster', 'console', 'constants', 'dgram', 'diagnostics_channel', 'dns',
  'domain', 'inspector', 'module', 'net', 'perf_hooks', 'punycode', 'repl',
  'sys', 'trace_events', 'v8', 'vm', 'wasi', 'worker_threads',
]);

/**
 * Check if an import is external (node_modules or built-in)
 */
function isExternalImport(importPath: string): boolean {
  if (!importPath) return false;
  if (BUILT_IN_MODULES.has(importPath)) return true;
  if (importPath.startsWith('node:')) return true;
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) return true;
  return false;
}

/**
 * Parse all imports from a TypeScript/JavaScript file
 */
function parseImports(filePath: string): ImportInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  // Calculate line numbers
  const lineOffsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      lineOffsets.push(i + 1);
    }
  }

  const getLineNumber = (index: number): number => {
    let low = 0;
    let high = lineOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] <= index) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  };

  let match: RegExpExecArray | null;
  IMPORT_REGEX.lastIndex = 0;

  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    // Get the import path from any of the capturing groups
    const importPath = match[1] || match[2] || match[3];
    if (!importPath) continue;

    const line = getLineNumber(match.index);
    const rawImport = match[0].trim();

    // Determine import type
    let importType: ImportInfo['importType'] = 'static';
    if (match[2]) {
      importType = 'dynamic';
    } else if (match[3]) {
      importType = 'require';
    } else if (rawImport.includes('import type')) {
      importType = 'type-only';
    }

    const key = `${importPath}:${line}:${importType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    imports.push({
      source: filePath,
      target: importPath,
      importType,
      isExternal: isExternalImport(importPath),
      line,
      rawImport: rawImport.slice(0, 100), // Limit length
    });
  }

  return imports;
}

// ============================================================================
// File Discovery
// ============================================================================

/**
 * Recursively find all TypeScript/JavaScript files in a directory
 */
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (CONFIG.excludePatterns.some((pattern) => pattern.test(fullPath))) {
        continue;
      }
      files.push(...findSourceFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (
        CONFIG.extensions.includes(ext) &&
        !CONFIG.excludePatterns.some((pattern) => pattern.test(fullPath))
      ) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// ============================================================================
// Dependency Graph Construction
// ============================================================================

/**
 * Resolve an import path to an absolute file path
 */
function resolveImport(
  importPath: string,
  sourceFile: string,
  sourceDirs: string[]
): string | null {
  if (isExternalImport(importPath)) {
    return null;
  }

  const sourceDir = path.dirname(sourceFile);

  // Handle relative imports
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(sourceDir, importPath);
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
        return withExt;
      }
    }
    // Try index files
    for (const indexExt of ['/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
      const indexPath = resolved + indexExt;
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }
    return null;
  }

  // Handle absolute imports within source directories
  for (const srcDir of sourceDirs) {
    const resolved = path.join(srcDir, importPath);
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
        return withExt;
      }
    }
    for (const indexExt of ['/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
      const indexPath = resolved + indexExt;
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }
  }

  return null;
}

/**
 * Build the dependency graph from source files
 */
function buildDependencyGraph(sourceDirs: string[]): DependencyGraph {
  const nodes = new Map<string, FileNode>();
  const edges: ImportInfo[] = [];

  // Find all source files
  const allFiles: string[] = [];
  for (const dir of sourceDirs) {
    allFiles.push(...findSourceFiles(dir));
  }

  // Create nodes for all files
  for (const file of allFiles) {
    nodes.set(file, {
      path: file,
      imports: [],
      importedBy: [],
    });
  }

  // Parse imports for each file
  for (const file of allFiles) {
    const imports = parseImports(file);
    const node = nodes.get(file)!;

    for (const imp of imports) {
      if (imp.isExternal) {
        node.imports.push(imp);
        continue;
      }

      const resolvedTarget = resolveImport(imp.target, file, sourceDirs);

      if (resolvedTarget && nodes.has(resolvedTarget)) {
        const resolvedImport: ImportInfo = {
          ...imp,
          target: resolvedTarget,
        };

        node.imports.push(resolvedImport);
        edges.push(resolvedImport);
        nodes.get(resolvedTarget)!.importedBy.push(file);
      } else {
        node.imports.push(imp);
      }
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Circular Dependency Detection (Tarjan's Algorithm)
// ============================================================================

/**
 * Find all circular dependencies using Tarjan's SCC algorithm
 */
function findCircularDependencies(graph: DependencyGraph): string[][] {
  const indexMap = new Map<string, number>();
  const lowlinkMap = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let index = 0;

  function strongConnect(nodePath: string): void {
    indexMap.set(nodePath, index);
    lowlinkMap.set(nodePath, index);
    index++;
    stack.push(nodePath);
    onStack.add(nodePath);

    const node = graph.nodes.get(nodePath);
    if (node) {
      for (const imp of node.imports) {
        if (imp.isExternal) continue;
        if (!graph.nodes.has(imp.target)) continue;

        if (!indexMap.has(imp.target)) {
          strongConnect(imp.target);
          lowlinkMap.set(
            nodePath,
            Math.min(lowlinkMap.get(nodePath)!, lowlinkMap.get(imp.target)!)
          );
        } else if (onStack.has(imp.target)) {
          lowlinkMap.set(
            nodePath,
            Math.min(lowlinkMap.get(nodePath)!, indexMap.get(imp.target)!)
          );
        }
      }
    }

    if (lowlinkMap.get(nodePath) === indexMap.get(nodePath)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== nodePath);

      if (component.length > 1) {
        // Found a cycle (SCC with more than one node)
        const cyclePath = findCyclePath(graph, component);
        if (cyclePath) {
          cycles.push(cyclePath);
        }
      }
    }
  }

  for (const nodePath of graph.nodes.keys()) {
    if (!indexMap.has(nodePath)) {
      strongConnect(nodePath);
    }
  }

  return cycles;
}

/**
 * Find the actual path of a cycle in a strongly connected component
 */
function findCyclePath(graph: DependencyGraph, component: string[]): string[] | null {
  const componentSet = new Set(component);
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(current: string, start: string): string[] | null {
    if (current === start && path.length > 0) {
      return [...path, start];
    }

    if (visited.has(current)) return null;
    visited.add(current);
    path.push(current);

    const node = graph.nodes.get(current);
    if (node) {
      for (const imp of node.imports) {
        if (imp.isExternal) continue;
        if (!componentSet.has(imp.target)) continue;

        const result = dfs(imp.target, start);
        if (result) return result;
      }
    }

    path.pop();
    return null;
  }

  return dfs(component[0], component[0]);
}

// ============================================================================
// Architectural Rule Validation
// ============================================================================

function validateCoreCannotImportWeb(
  graph: DependencyGraph,
  rule: typeof CONFIG.rules.coreCannotImportWeb
): Violation[] {
  const violations: Violation[] = [];
  const fromDir = path.resolve(process.cwd(), rule.from);
  const toDir = path.resolve(process.cwd(), rule.to);

  for (const edge of graph.edges) {
    if (edge.source.startsWith(fromDir) && edge.target.startsWith(toDir)) {
      violations.push({
        rule: 'coreCannotImportWeb',
        severity: 'error',
        message: rule.message,
        source: edge.source,
        target: edge.target,
        line: edge.line,
        suggestion: rule.suggestion,
      });
    }
  }

  return violations;
}

function validateProvidersUsePolicy(
  graph: DependencyGraph,
  rule: typeof CONFIG.rules.providersMustUsePolicy
): Violation[] {
  const violations: Violation[] = [];

  for (const [filePath, node] of graph.nodes) {
    const isProvider = rule.providerPatterns.some((pattern) =>
      pattern.test(filePath)
    );
    if (!isProvider) continue;

    const hasPolicyImport = node.imports.some((imp) =>
      rule.requiredImports.some((required) =>
        imp.target.toLowerCase().includes(required.toLowerCase())
      )
    );

    if (!hasPolicyImport) {
      violations.push({
        rule: 'providersMustUsePolicy',
        severity: 'warning',
        message: rule.message,
        source: filePath,
        target: '',
        line: 0,
        suggestion: rule.suggestion,
      });
    }
  }

  return violations;
}

function validatePolicyCannotImportAdapters(
  graph: DependencyGraph,
  rule: typeof CONFIG.rules.policyCannotImportAdapters
): Violation[] {
  const violations: Violation[] = [];

  for (const edge of graph.edges) {
    const sourceIsPolicy = rule.policyPatterns.some((pattern) =>
      pattern.test(edge.source)
    );
    if (!sourceIsPolicy) continue;

    const targetsAdapter = rule.forbiddenPatterns.some((pattern) =>
      pattern.test(edge.target)
    );
    if (!targetsAdapter) continue;

    violations.push({
      rule: 'policyCannotImportAdapters',
      severity: 'error',
      message: rule.message,
      source: edge.source,
      target: edge.target,
      line: edge.line,
      suggestion: rule.suggestion,
    });
  }

  return violations;
}

function validateRules(
  graph: DependencyGraph,
  cycles: string[][]
): Violation[] {
  const violations: Violation[] = [];

  if (CONFIG.rules.coreCannotImportWeb.enabled) {
    violations.push(
      ...validateCoreCannotImportWeb(graph, CONFIG.rules.coreCannotImportWeb)
    );
  }

  if (CONFIG.rules.providersMustUsePolicy.enabled) {
    violations.push(
      ...validateProvidersUsePolicy(graph, CONFIG.rules.providersMustUsePolicy)
    );
  }

  if (CONFIG.rules.policyCannotImportAdapters.enabled) {
    violations.push(
      ...validatePolicyCannotImportAdapters(
        graph,
        CONFIG.rules.policyCannotImportAdapters
      )
    );
  }

  for (const cycle of cycles) {
    const cycleStr = cycle.map((p) => path.basename(p)).join(' → ');
    violations.push({
      rule: 'noCircularDependencies',
      severity: 'error',
      message: `Circular dependency: ${cycleStr}`,
      source: cycle[0],
      target: cycle[cycle.length - 2] || cycle[0],
      line: 0,
      suggestion:
        'Break the cycle by extracting shared code to a common module or using dependency injection',
    });
  }

  return violations;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateRecommendedFixes(violations: Violation[], cycles: string[][]): string[] {
  const fixes: string[] = [];
  const violationsByRule = new Map<string, Violation[]>();

  for (const v of violations) {
    const existing = violationsByRule.get(v.rule) || [];
    existing.push(v);
    violationsByRule.set(v.rule, existing);
  }

  for (const [rule, ruleViolations] of violationsByRule) {
    switch (rule) {
      case 'coreCannotImportWeb':
        fixes.push(
          `[${rule}] Create a shared types package for common interfaces between cli and ready-layer`,
          `[${rule}] Move shared utilities to packages/shared/ directory`,
          `[${rule}] Use API boundaries (REST/gRPC) instead of direct imports between layers`
        );
        break;
      case 'providersMustUsePolicy':
        fixes.push(
          `[${rule}] Import PolicyGate from the policy module in provider files`,
          `[${rule}] Add policy enforcement checks before all provider operations`
        );
        break;
      case 'policyCannotImportAdapters':
        fixes.push(
          `[${rule}] Use dependency injection to provide adapter instances to policy`,
          `[${rule}] Define interfaces in policy layer, implement in adapter layer`
        );
        break;
      case 'noCircularDependencies':
        fixes.push(
          `[${rule}] Identify shared code and extract to a common module`,
          `[${rule}] Use interfaces/abstractions to break direct dependencies`
        );
        break;
    }
  }

  for (const cycle of cycles) {
    const cycleFiles = cycle.slice(0, -1);
    fixes.push(
      `[Circular] Cycle: ${cycleFiles.map((f) => path.basename(f)).join(' → ')}`
    );
  }

  return [...new Set(fixes)];
}

function calculateGraphStats(graph: DependencyGraph): Report['graphStats'] {
  let totalImports = 0;
  let maxImports = 0;
  let maxImportsFile = '';
  const disconnected: string[] = [];

  for (const [filePath, node] of graph.nodes) {
    const importCount = node.imports.filter((imp) => !imp.isExternal).length;
    totalImports += importCount;

    if (importCount > maxImports) {
      maxImports = importCount;
      maxImportsFile = filePath;
    }

    if (importCount === 0 && node.importedBy.length === 0) {
      disconnected.push(filePath);
    }
  }

  const fileCount = graph.nodes.size;

  return {
    nodes: fileCount,
    edges: graph.edges.length,
    avgImportsPerFile: fileCount > 0 ? totalImports / fileCount : 0,
    maxImportsInFile: maxImports,
    maxImportsFile,
    disconnectedNodes: disconnected,
  };
}

function generateReport(
  graph: DependencyGraph,
  violations: Violation[],
  cycles: string[][]
): Report {
  const stats = calculateGraphStats(graph);
  const internalImports = graph.edges.filter((e) => !e.isExternal).length;
  const externalImports = graph.edges.filter((e) => e.isExternal).length;

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: graph.nodes.size,
      totalImports: internalImports + externalImports,
      externalImports,
      internalImports,
      violationsFound: violations.length,
      circularDependencies: cycles.length,
    },
    violations,
    circularPaths: cycles,
    graphStats: stats,
    recommendedFixes: generateRecommendedFixes(violations, cycles),
  };
}

// ============================================================================
// Report Output
// ============================================================================

function formatConsoleReport(report: Report): string {
  const lines: string[] = [];

  lines.push('╔════════════════════════════════════════════════════════════════╗');
  lines.push('║       DEPENDENCY GRAPH CHECKER REPORT                          ║');
  lines.push('╚════════════════════════════════════════════════════════════════╝');
  lines.push('');

  lines.push('📊 SUMMARY');
  lines.push('─'.repeat(60));
  lines.push(`Total Files:          ${report.summary.totalFiles}`);
  lines.push(`Total Imports:        ${report.summary.totalImports}`);
  lines.push(`  - Internal:         ${report.summary.internalImports}`);
  lines.push(`  - External:         ${report.summary.externalImports}`);
  lines.push(`Violations Found:     ${report.summary.violationsFound}`);
  lines.push(`Circular Dependencies: ${report.summary.circularDependencies}`);
  lines.push('');

  lines.push('📈 GRAPH STATISTICS');
  lines.push('─'.repeat(60));
  lines.push(`Nodes:                ${report.graphStats.nodes}`);
  lines.push(`Edges:                ${report.graphStats.edges}`);
  lines.push(`Avg Imports/File:     ${report.graphStats.avgImportsPerFile.toFixed(2)}`);
  lines.push(`Max Imports (File):   ${report.graphStats.maxImportsInFile} in ${path.basename(report.graphStats.maxImportsFile)}`);
  if (report.graphStats.disconnectedNodes.length > 0) {
    lines.push(`Disconnected Nodes:   ${report.graphStats.disconnectedNodes.length}`);
  }
  lines.push('');

  if (report.violations.length > 0) {
    lines.push('❌ VIOLATIONS');
    lines.push('─'.repeat(60));

    const byRule = new Map<string, Violation[]>();
    for (const v of report.violations) {
      const existing = byRule.get(v.rule) || [];
      existing.push(v);
      byRule.set(v.rule, existing);
    }

    for (const [rule, ruleViolations] of byRule) {
      lines.push(`\n[${rule.toUpperCase()}] - ${ruleViolations.length} violation(s)`);
      for (const v of ruleViolations.slice(0, 5)) {
        const icon = v.severity === 'error' ? '🔴' : '⚠️';
        lines.push(`  ${icon} ${v.message}`);
        lines.push(`     Source: ${path.relative(process.cwd(), v.source)}${v.line > 0 ? ':' + v.line : ''}`);
        if (v.target) {
          lines.push(`     Target: ${path.relative(process.cwd(), v.target)}`);
        }
        if (v.suggestion) {
          lines.push(`     💡 ${v.suggestion}`);
        }
      }
      if (ruleViolations.length > 5) {
        lines.push(`  ... and ${ruleViolations.length - 5} more`);
      }
    }
    lines.push('');
  }

  if (report.circularPaths.length > 0) {
    lines.push('🔄 CIRCULAR DEPENDENCIES');
    lines.push('─'.repeat(60));
    for (let i = 0; i < report.circularPaths.length; i++) {
      const cycle = report.circularPaths[i];
      lines.push(`\n  Cycle ${i + 1}:`);
      const simplified = cycle.map((f) => path.relative(process.cwd(), f));
      lines.push(`    ${simplified.join(' → ')}`);
    }
    lines.push('');
  }

  if (report.recommendedFixes.length > 0) {
    lines.push('🔧 RECOMMENDED FIXES');
    lines.push('─'.repeat(60));
    for (const fix of report.recommendedFixes.slice(0, 10)) {
      lines.push(`  • ${fix}`);
    }
    if (report.recommendedFixes.length > 10) {
      lines.push(`  ... and ${report.recommendedFixes.length - 10} more in the JSON report`);
    }
    lines.push('');
  }

  lines.push('─'.repeat(60));
  if (report.summary.violationsFound === 0) {
    lines.push('✅ All checks passed! No violations found.');
  } else {
    const errors = report.violations.filter((v) => v.severity === 'error').length;
    const warnings = report.violations.filter((v) => v.severity === 'warning').length;
    lines.push(`❌ Found ${errors} error(s) and ${warnings} warning(s).`);
  }
  lines.push('');

  return lines.join('\n');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('🔍 Dependency Graph Checker');
  console.log('Scanning source directories...\n');

  const startTime = Date.now();

  const graph = buildDependencyGraph(CONFIG.sourceDirs);
  console.log(`✓ Parsed ${graph.nodes.size} files`);
  console.log(`✓ Found ${graph.edges.length} internal dependencies`);

  const cycles = findCircularDependencies(graph);
  console.log(`✓ Detected ${cycles.length} circular dependency chain(s)`);

  const violations = validateRules(graph, cycles);
  console.log(`✓ Validated ${violations.length} violation(s)\n`);

  const report = generateReport(graph, violations, cycles);

  console.log(formatConsoleReport(report));

  ensureDir('reports');
  const reportPath = path.resolve(process.cwd(), 'reports/dependency-graph-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  Completed in ${elapsed}ms`);

  const hasErrors = violations.some((v) => v.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export {
  parseImports,
  buildDependencyGraph,
  findCircularDependencies,
  validateRules,
  generateReport,
  isExternalImport,
  resolveImport,
};
