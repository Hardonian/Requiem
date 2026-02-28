/**
 * @fileoverview Sandboxed directory listing tool.
 *
 * INVARIANT: Only lists within REQUIEM_WORKSPACE_ROOT.
 * INVARIANT: No path traversal.
 * INVARIANT: Result is sorted and capped to prevent DoS.
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { registerTool } from '../registry.js';
import { sandboxPath } from '../sandbox.js';
import { AiError } from '../../errors/AiError.js';
import { AiErrorCode } from '../../errors/codes.js';

const MAX_ENTRIES = 500;
const WORKSPACE_ROOT = process.env['REQUIEM_WORKSPACE_ROOT'] ?? process.cwd();

registerTool(
  {
    name: 'fs.list_dir',
    version: '1.0.0',
    description: 'List directory contents within the workspace sandbox.',
    deterministic: true,
    sideEffect: false,
    idempotent: true,
    tenantScoped: true,
    requiredCapabilities: ['tools:read'],
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description: 'Directory path within workspace root',
          maxLength: 4096,
        },
        recursive: {
          type: 'boolean',
          description: 'List recursively (capped at MAX_ENTRIES)',
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['entries', 'path', 'total'],
      properties: {
        entries: { type: 'array', items: { type: 'object' } },
        path: { type: 'string' },
        total: { type: 'number' },
        truncated: { type: 'boolean' },
      },
    },
  },
  async (_ctx, input) => {
    const { path, recursive = false } = input as { path: string; recursive?: boolean };

    const resolved = sandboxPath(path, WORKSPACE_ROOT);

    if (!existsSync(resolved)) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_PATH_INVALID,
        message: `Directory not found: ${path}`,
        phase: 'fs.list_dir',
      });
    }

    const stat = statSync(resolved);
    if (!stat.isDirectory()) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_PATH_INVALID,
        message: `Path is not a directory: ${path}`,
        phase: 'fs.list_dir',
      });
    }

    const entries: Array<{ name: string; type: 'file' | 'directory'; size?: number }> = [];
    let truncated = false;

    function collect(dir: string, depth: number): void {
      if (entries.length >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
      const items = readdirSync(dir).sort();
      for (const item of items) {
        if (entries.length >= MAX_ENTRIES) { truncated = true; break; }
        const full = join(dir, item);
        try {
          const s = statSync(full);
          if (s.isDirectory()) {
            entries.push({ name: full.replace(WORKSPACE_ROOT + '/', ''), type: 'directory' });
            if (recursive && depth < 10) collect(full, depth + 1);
          } else {
            entries.push({ name: full.replace(WORKSPACE_ROOT + '/', ''), type: 'file', size: s.size });
          }
        } catch { /* skip unreadable entries */ }
      }
    }

    collect(resolved, 0);

    return { entries, path: resolved, total: entries.length, truncated };
  }
);
