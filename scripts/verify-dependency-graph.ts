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
  column: number;
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
// Import Parsing
// ============================================================================

/**
 * Parse all imports from a TypeScript/JavaScript file
 */
function parseImports(filePath: string): ImportInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  // Regex patterns for different import types
  const patterns = {
    // Static imports: import { x } from 'module' or import type { x } from 'module'
    staticImport:
      /import\s+(?:type\s+)?(?:\*\s+as\s+\w+|\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)['"];?/g,
    // Side-effect imports: import 'module'
    sideEffectImport: /import\s+['"]([^'"]+)['"];?/g,
    // Dynamic imports: import('module')
    dynamicImport: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // require statements: require('module')
    requireImport: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Type-only imports: import type { x } from 'module'
    typeOnlyImport:
      /import\s+type\s+(?:\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)['"];?/g,
  };

  // Track line numbers for each match
  const getLineColumn = (index: number): { line: number; column: number } => {
    let line = 1;
    let column = 1;
    for (let i = 0; i < index && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    return { line, column };
  };

  // Parse static imports
  let match: RegExpExecArray | null;
  const staticRegex = new RegExp(patterns.staticImport.source, 'g');
  while ((match = staticRegex.exec(content)) !== null) {
    const pos = getLineColumn(match.index);
    const rawImport = match[0];
    const isTypeOnly =
      rawImport.includes('import type') || rawImport.includes('import type');

    imports.push({
      source: filePath,
      target: match[1],
      importType: isTypeOnly ? 'type-only' : 'static',
      isExternal: isExternalImport(match[1]),
      line: pos.line,
      column: pos.column,
      rawImport,
    });
  }

  // Parse side-effect imports
  const sideEffectRegex = new RegExp(patterns.sideEffectImport.source, 'g');
  while ((match = sideEffectRegex.exec(content)) !== null) {
    // Skip if already captured as static import
    if (imports.some((imp) => imp.target === match![1] && imp.line === getLineColumn(match!.index).line)) {
      continue;
    }
    const pos = getLineColumn(match.index);
    imports.push({
      source: filePath,
      target: match[1],
      importType: 'static',
      isExternal: isExternalImport(match[1]),
      line: pos.line,
      column: pos.column,
      rawImport: match[0],
    });
  }

  // Parse dynamic imports
  const dynamicRegex = new RegExp(patterns.dynamicImport.source, 'g');
  while ((match = dynamicRegex.exec(content)) !== null) {
    const pos = getLineColumn(match.index);
    imports.push({
      source: filePath,
      target: match[1],
      importType: 'dynamic',
      isExternal: isExternalImport(match[1]),
      line: pos.line,
      column: pos.column,
      rawImport: match[0],
    });
  }

  // Parse require statements
  const requireRegex = new RegExp(patterns.requireImport.source, 'g');
  while ((match = requireRegex.exec(content)) !== null) {
    const pos = getLineColumn(match.index);
    imports.push({
      source: filePath,
      target: match[1],
      importType: 'require',
      isExternal: isExternalImport(match[1]),
      line: pos.line,
      column: pos.column,
      rawImport: match[0],
    });
  }

  // Deduplicate imports
  return imports.filter(
    (imp, index, self) =>
      index ===
      self.findIndex(
        (t) => t.target === imp.target && t.line === imp.line && t.importType === imp.importType
      )
  );
}

/**
 * Check if an import is external (node_modules or built-in)
 */
function isExternalImport(importPath: string): boolean {
  // Built-in Node.js modules
  const builtInModules = [
    'fs',
    'path',
    'url',
    'util',
    'stream',
    'crypto',
    'http',
    'https',
    'os',
    'child_process',
    'events',
    'buffer',
    'process',
    'querystring',
    'readline',
    'string_decoder',
    'timers',
    'tls',
    'tty',
    'zlib',
    'assert',
    'async_hooks',
    'cluster',
    'console',
    'constants',
    'dgram',
    'diagnostics_channel',
    'dns',
    'domain',
    'inspector',
    'module',
    'net',
    'perf_hooks',
    'punycode',
    'repl',
    'sys',
    'trace_events',
    'v8',
    'vm',
    'wasi',
    'worker_threads',
  ];

  // Check for built-in module or node_modules import
  if (builtInModules.includes(importPath)) return true;
  if (importPath.startsWith('node:')) return true;
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) return true;

  return false;
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
    console.warn(`Warning: Directory does not exist: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories
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
  // Skip external imports
  if (isExternalImport(importPath)) {
    return null;
  }

  const sourceDir = path.dirname(sourceFile);

  // Handle relative imports
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(sourceDir, importPath);
    return resolveWithExtensions(resolved);
  }

  // Handle absolute imports within source directories
  // This handles path aliases like @/lib/engine
  for (const srcDir of sourceDirs) {
    // Try direct resolution
    const resolved = path.join(srcDir, importPath);
    const withExt = resolveWithExtensions(resolved);
    if (withExt) return withExt;

    // Try with index file
    const indexFile = resolveWithExtensions(path.join(resolved, 'index'));
    if (indexFile) return indexFile;
  }

  return null;
}

/**
 * Try to resolve a path with different extensions
 */
function resolveWithExtensions(filePath: string): string | null {
  for (const ext of ['', ...CONFIG.extensions]) {
    const withExt = filePath + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
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
      // Skip external imports for graph edges (but keep them for statistics)
      if (imp.isExternal) {
        node.imports.push(imp);
        continue;
      }

      // Resolve the import to a file path
      const resolvedTarget = resolveImport(imp.target, file, sourceDirs);

      if (resolvedTarget) {
        const resolvedImport: ImportInfo = {
          ...imp,
          target: resolvedTarget,
        };

        node.imports.push(resolvedImport);
        edges.push(resolvedImport);

        // Update importedBy for target
        const targetNode = nodes.get(resolvedTarget);
        if (targetNode) {
          targetNode.importedBy.push(file);
        }
      } else {
        // Keep unresolved imports (may be path aliases we couldn't resolve)
        node.imports.push(imp);
      }
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Circular Dependency Detection
// ============================================================================

/**
 * Find all circular dependencies using DFS
 */
function findCircularDependencies(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodePath: string): void {
    if (recursionStack.has(nodePath)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodePath);
      const cycle = path.slice(cycleStart).concat([nodePath]);
      cycles.push(cycle);
      return;
    }

    if (visited.has(nodePath)) {
      return;
    }

    visited.add(nodePath);
    recursionStack.add(nodePath);
    path.push(nodePath);

    const node = graph.nodes.get(nodePath);
    if (node) {
      for (const imp of node.imports) {
        if (!imp.isExternal) {
          dfs(imp.target);
        }
      }
    }

    path.pop();
    recursionStack.delete(nodePath);
  }

  // Run DFS from each node
  for (const nodePath of graph.nodes.keys()) {
    if (!visited.has(nodePath)) {
      dfs(nodePath);
    }
  }

  // Remove duplicate cycles (same cycle starting from different nodes)
  return deduplicateCycles(cycles);
}

/**
 * Remove duplicate cycles (same nodes in different order)
 */
function deduplicateCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];

  for (const cycle of cycles) {
    // Normalize the cycle by rotating to start with the smallest path
    const normalized = normalizeCycle(cycle);
    const key = normalized.join('->');

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(normalized);
    }
  }

  return unique;
}

/**
 * Normalize a cycle by rotating to start with the smallest path
 */
function normalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) return cycle;

  // Remove the duplicate end node
  const nodes = cycle.slice(0, -1);

  // Find the rotation that gives the smallest string
  let minRotation = 0;
  let minString = nodes.join(',');

  for (let i = 1; i < nodes.length; i++) {
    const rotated = nodes.slice(i).concat(nodes.slice(0, i));
    const rotatedString = rotated.join(',');
    if (rotatedString < minString) {
      minRotation = i;
      minString = rotatedString;
    }
  }

  const result = nodes
    .slice(minRotation)
    .concat(nodes.slice(0, minRotation));
  return result.concat([result[0]]);
}

// ============================================================================
// Architectural Rule Validation
// ============================================================================

/**
 * Validate that core cannot import web layer
 */
function validateCoreCannotImportWeb(
  graph: DependencyGraph,
  rule: typeof CONFIG.rules.coreCannotImportWeb
): Violation[] {
  const violations: Violation[] = [];

  const fromDir = path.resolve(process.cwd(), rule.from);
  const toDir = path.resolve(process.cwd(), rule.to);

  for (const edge of graph.edges) {
    const sourceDir = path.dirname(edge.source);
    const targetDir = path.dirname(edge.target);

    if (
      sourceDir.startsWith(fromDir) &&
      targetDir.startsWith(toDir)
    ) {
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

/**
 * Validate that providers use policy enforcement
 */
function validateProvidersUsePolicy(
  graph: DependencyGraph,
  rule: typeof CONFIG.rules.providersMustUsePolicy
): Violation[] {
  const violations: Violation[] = [];

  for (const [filePath, node] of graph.nodes) {
    // Check if file is a provider file
    const isProvider = rule.providerPatterns.some((pattern) =>
      pattern.test(filePath)
    );

    if (!isProvider) continue;

    // Check if provider imports any policy-related modules
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

/**
 * Validate that policy layer cannot import provider adapters
 */
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

    if (targetsAdapter) {
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
  }

  return violations;
}

/**
 * Validate all architectural rules
 */
function validateRules(
  graph: DependencyGraph,
  cycles: string[][]
): Violation[] {
  const violations: Violation[] = [];

  // Rule 1: Core cannot import web
  if (CONFIG.rules.coreCannotImportWeb.enabled) {
    violations.push(
      ...validateCoreCannotImportWeb(graph, CONFIG.rules.coreCannotImportWeb)
    );
  }

  // Rule 2: Providers must use policy
  if (CONFIG.rules.providersMustUsePolicy.enabled) {
    violations.push(
      ...validateProvidersUsePolicy(graph, CONFIG.rules.providersMustUsePolicy)
    );
  }

  // Rule 3: Policy cannot import adapters
  if (CONFIG.rules.policyCannotImportAdapters.enabled) {
    violations.push(
      ...validatePolicyCannotImportAdapters(
        graph,
        CONFIG.rules.policyCannotImportAdapters
      )
    );
  }

  // Rule 4: Circular dependencies
  for (const cycle of cycles) {
    const cycleStr = cycle.join(' → ');
    violations.push({
      rule: 'noCircularDependencies',
      severity: 'error',
      message: `Circular dependency detected: ${cycleStr}`,
      source: cycle[0],
      target: cycle[cycle.length - 2] || cycle[0],
      line: 0,
      suggestion:
        'Break the cycle by: (1) Moving shared code to a common module, (2) Using dependency injection, (3) Creating an interface/abstraction layer',
    });
  }

  return violations;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate recommended fixes based on violations
 */
function generateRecommendedFixes(violations: Violation[], cycles: string[][]): string[] {
  const fixes: string[] = [];
  const violationsByRule = new Map<string, Violation[]>();

  // Group violations by rule
  for (const v of violations) {
    const existing = violationsByRule.get(v.rule) || [];
    existing.push(v);
    violationsByRule.set(v.rule, existing);
  }

  // Generate fixes for each rule
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
          `[${rule}] Add policy enforcement checks before all provider operations`,
          `[${rule}] Consider using a decorator/wrapper pattern for policy enforcement`
        );
        break;

      case 'policyCannotImportAdapters':
        fixes.push(
          `[${rule}] Use dependency injection to provide adapter instances to policy`,
          `[${rule}] Define interfaces in policy layer, implement in adapter layer`,
          `[${rule}] Move shared types to a separate contract/definitions file`
        );
        break;

      case 'noCircularDependencies':
        fixes.push(
          `[${rule}] Identify shared code and extract to a common module`,
          `[${rule}] Use interfaces/abstractions to break direct dependencies`,
          `[${rule}] Consider lazy loading for runtime circular dependencies`,
          `[${rule}] Apply dependency inversion principle (DIP)`
        );
        break;
    }
  }

  // Add specific fixes for cycles
  for (const cycle of cycles) {
    const cycleFiles = cycle.slice(0, -1); // Remove duplicate end
    fixes.push(
      `[Circular] Cycle: ${cycleFiles.map((f) => path.basename(f)).join(' → ')}`,
      `  - Consider extracting shared logic to: ${path.dirname(cycle[0])}/shared.ts`
    );
  }

  return [...new Set(fixes)];
}

/**
 * Calculate graph statistics
 */
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

/**
 * Generate the final report
 */
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

/**
 * Format report for console output
 */
function formatConsoleReport(report: Report): string {
  const lines: string[] = [];

  lines.push('╔════════════════════════════════════════════════════════════════╗');
  lines.push('║       DEPENDENCY GRAPH CHECKER REPORT                          ║');
  lines.push('╚════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Summary
  lines.push('📊 SUMMARY');
  lines.push('─'.repeat(60));
  lines.push(`Total Files:          ${report.summary.totalFiles}`);
  lines.push(`Total Imports:        ${report.summary.totalImports}`);
  lines.push(`  - Internal:         ${report.summary.internalImports}`);
  lines.push(`  - External:         ${report.summary.externalImports}`);
  lines.push(`Violations Found:     ${report.summary.violationsFound}`);
  lines.push(`Circular Dependencies: ${report.summary.circularDependencies}`);
  lines.push('');

  // Graph Statistics
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

  // Violations
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

  // Circular Dependencies
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

  // Recommended Fixes
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

  // Status
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

/**
 * Ensure directory exists
 */
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

  // Build dependency graph
  const graph = buildDependencyGraph(CONFIG.sourceDirs);
  console.log(`✓ Parsed ${graph.nodes.size} files`);
  console.log(`✓ Found ${graph.edges.length} internal dependencies`);

  // Find circular dependencies
  const cycles = findCircularDependencies(graph);
  console.log(`✓ Detected ${cycles.length} circular dependency chain(s)`);

  // Validate rules
  const violations = validateRules(graph, cycles);
  console.log(`✓ Validated ${violations.length} violation(s)\n`);

  // Generate report
  const report = generateReport(graph, violations, cycles);

  // Console output
  console.log(formatConsoleReport(report));

  // Save JSON report
  ensureDir('reports');
  const reportPath = path.resolve(process.cwd(), 'reports/dependency-graph-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  Completed in ${elapsed}ms`);

  // Exit with appropriate code
  const hasErrors = violations.some((v) => v.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
}

// Run if called directly
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
