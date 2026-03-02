/**
 * CI Gate: Verify no implicit `any` in core engine paths.
 *
 * Fails if `any` (non-eslint-suppressed) appears in:
 * - packages/cli/src/engine/
 * - packages/cli/src/lib/fallback.ts
 * - packages/cli/src/lib/policy-snapshot.ts
 * - packages/cli/src/lib/run-lifecycle.ts
 * - packages/cli/src/lib/invariant-assertions.ts
 * - packages/cli/src/lib/branded-types.ts
 * - packages/cli/src/lib/state-machine.ts
 *
 * Explicit `any` with eslint-disable comment is exempted (intentional escape hatch).
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

const CORE_PATHS = [
  'packages/cli/src/engine',
  'packages/cli/src/lib/fallback.ts',
  'packages/cli/src/lib/policy-snapshot.ts',
  'packages/cli/src/lib/run-lifecycle.ts',
  'packages/cli/src/lib/invariant-assertions.ts',
  'packages/cli/src/lib/branded-types.ts',
  'packages/cli/src/lib/state-machine.ts',
  'packages/cli/src/lib/clock.ts',
  'packages/cli/src/lib/hash.ts',
];

/** Regex to find `: any` or `as any` that is NOT preceded by eslint-disable */
const ANY_PATTERN = /(?<!eslint-disable[^\n]*)\b(:\s*any\b|as\s+any\b)/;

/** Lines with these patterns are exempted */
const EXEMPT_PATTERNS = [
  /eslint-disable/,
  /\/\/.*\bany\b/,  // Comment containing "any" (not actual usage)
];

interface Violation {
  file: string;
  line: number;
  content: string;
}

function collectFiles(p: string): string[] {
  const fullPath = path.join(ROOT, p);
  if (!fs.existsSync(fullPath)) return [];

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return p.endsWith('.ts') || p.endsWith('.tsx') ? [fullPath] : [];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(path.join(fullPath, entry.name));
    } else if (entry.isDirectory()) {
      files.push(...collectFiles(path.join(p, entry.name)));
    }
  }
  return files;
}

function checkFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines with eslint-disable
    if (EXEMPT_PATTERNS.some(pat => pat.test(line))) continue;

    if (ANY_PATTERN.test(line)) {
      violations.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        content: line.trim(),
      });
    }
  }

  return violations;
}

function main(): void {
  const allFiles: string[] = [];
  for (const p of CORE_PATHS) {
    allFiles.push(...collectFiles(p));
  }

  const allViolations: Violation[] = [];
  for (const file of allFiles) {
    allViolations.push(...checkFile(file));
  }

  if (allViolations.length === 0) {
    console.log(`✓ No implicit \`any\` found in ${allFiles.length} core engine files.`);
    process.exit(0);
  }

  console.error(`✗ Found ${allViolations.length} implicit \`any\` in core engine paths:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.content}`);
  }
  console.error(`\nAdd explicit types or use eslint-disable with justification.`);
  process.exit(1);
}

main();
