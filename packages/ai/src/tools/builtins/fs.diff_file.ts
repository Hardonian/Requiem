/**
 * @fileoverview Sandboxed file diff tool.
 *
 * INVARIANT: Both paths must be within workspace root.
 * INVARIANT: Output is a unified diff string (not executable).
 * INVARIANT: Max diff output size enforced.
 */

import { readFileSync, existsSync } from 'fs';
import { registerTool } from '../registry.js';
import { sandboxPath } from '../sandbox.js';
import { AiError } from '../../errors/AiError.js';
import { AiErrorCode } from '../../errors/codes.js';

const WORKSPACE_ROOT = process.env['REQUIEM_WORKSPACE_ROOT'] ?? process.cwd();
const MAX_DIFF_LINES = 2000;

/** Minimal unified diff implementation (no external deps). */
function unifiedDiff(oldLines: string[], newLines: string[], oldPath: string, newPath: string): string {
  const result: string[] = [`--- ${oldPath}`, `+++ ${newPath}`];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build edit script using patience diff heuristic (simple O(mn) DP)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Reconstruct diff
  const hunks: string[] = [];
  let i = 0, j = 0;
  let hunkStart = -1;
  const hunkLines: string[] = [];

  function flushHunk(): void {
    if (hunkLines.length > 0) {
      result.push(`@@ -${hunkStart + 1} +${hunkStart + 1} @@`);
      result.push(...hunkLines);
      hunkLines.length = 0;
    }
  }

  while (i < m || j < n) {
    if (result.length > MAX_DIFF_LINES) {
      result.push('... (diff truncated)');
      break;
    }

    if (i < m && j < n && oldLines[i] === newLines[j]) {
      flushHunk();
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= (i < m ? dp[i + 1][j] : 0))) {
      if (hunkStart === -1) hunkStart = j;
      hunkLines.push(`+${newLines[j]}`);
      j++;
    } else {
      if (hunkStart === -1) hunkStart = i;
      hunkLines.push(`-${oldLines[i]}`);
      i++;
    }
  }
  flushHunk();

  void hunks; // unused var
  return result.join('\n');
}

registerTool(
  {
    name: 'fs.diff_file',
    version: '1.0.0',
    description: 'Generate a unified diff between two files or between a file and provided content.',
    deterministic: true,
    sideEffect: false,
    idempotent: true,
    tenantScoped: true,
    requiredCapabilities: ['tools:read'],
    inputSchema: {
      type: 'object',
      required: ['path_a'],
      properties: {
        path_a: {
          type: 'string',
          description: 'First file path (original)',
          maxLength: 4096,
        },
        path_b: {
          type: 'string',
          description: 'Second file path (modified). Provide either path_b or content_b.',
          maxLength: 4096,
        },
        content_b: {
          type: 'string',
          description: 'Modified content as string (alternative to path_b)',
          maxLength: 1_048_576,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['diff', 'changes'],
      properties: {
        diff: { type: 'string' },
        changes: { type: 'number' },
        additions: { type: 'number' },
        deletions: { type: 'number' },
      },
    },
  },
  async (_ctx, input) => {
    const { path_a, path_b, content_b } = input as {
      path_a: string;
      path_b?: string;
      content_b?: string;
    };

    const resolvedA = sandboxPath(path_a, WORKSPACE_ROOT);

    if (!existsSync(resolvedA)) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_PATH_INVALID,
        message: `File not found: ${path_a}`,
        phase: 'fs.diff_file',
      });
    }

    const oldContent = readFileSync(resolvedA, 'utf8');
    let newContent: string;
    let newLabel: string;

    if (content_b !== undefined) {
      newContent = content_b;
      newLabel = `${path_a} (modified)`;
    } else if (path_b) {
      const resolvedB = sandboxPath(path_b, WORKSPACE_ROOT);
      if (!existsSync(resolvedB)) {
        throw new AiError({
          code: AiErrorCode.SANDBOX_PATH_INVALID,
          message: `File not found: ${path_b}`,
          phase: 'fs.diff_file',
        });
      }
      newContent = readFileSync(resolvedB, 'utf8');
      newLabel = resolvedB;
    } else {
      throw new AiError({
        code: AiErrorCode.TOOL_SCHEMA_VIOLATION,
        message: 'Must provide either path_b or content_b',
        phase: 'fs.diff_file',
      });
    }

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = unifiedDiff(oldLines, newLines, resolvedA, newLabel);

    const additions = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
    const deletions = diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length;

    return { diff, changes: additions + deletions, additions, deletions };
  }
);
