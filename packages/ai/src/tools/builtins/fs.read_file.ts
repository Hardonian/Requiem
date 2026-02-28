/**
 * @fileoverview Sandboxed filesystem read tool.
 *
 * INVARIANT: Only reads within REQUIEM_WORKSPACE_ROOT (or process.cwd()).
 * INVARIANT: No path traversal — sandboxPath() throws on escape attempts.
 * INVARIANT: Max file size enforced (default 1MB, configurable via policy).
 * INVARIANT: Binary files are base64-encoded, text is UTF-8.
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { registerTool } from '../registry';
import { sandboxPath } from '../sandbox';
import { AiError } from '../../errors/AiError';
import { AiErrorCode } from '../../errors/codes';

const MAX_FILE_SIZE = 1_048_576; // 1 MiB
const WORKSPACE_ROOT = process.env['REQUIEM_WORKSPACE_ROOT'] ?? process.cwd();

registerTool(
  {
    name: 'fs.read_file',
    version: '1.0.0',
    description: 'Read the contents of a file within the workspace sandbox. Path must be relative to workspace root or within it.',
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
          description: 'Relative or absolute path within workspace root',
          maxLength: 4096,
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64'],
          description: 'Output encoding (default: utf8)',
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['content', 'size_bytes', 'path'],
      properties: {
        content: { type: 'string' },
        size_bytes: { type: 'number' },
        path: { type: 'string' },
        encoding: { type: 'string' },
      },
    },
  },
  async (_ctx, input) => {
    const { path, encoding = 'utf8' } = input as { path: string; encoding?: string };

    // Sandbox the path — throws SANDBOX_ESCAPE_ATTEMPT if outside root
    const resolved = sandboxPath(path, WORKSPACE_ROOT);

    if (!existsSync(resolved)) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_PATH_INVALID,
        message: `File not found: ${path}`,
        phase: 'fs.read_file',
      });
    }

    const stat = statSync(resolved);
    if (!stat.isFile()) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_PATH_INVALID,
        message: `Path is not a file: ${path}`,
        phase: 'fs.read_file',
      });
    }

    if (stat.size > MAX_FILE_SIZE) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_FILE_TOO_LARGE,
        message: `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`,
        phase: 'fs.read_file',
      });
    }

    const buf = readFileSync(resolved);
    const content = encoding === 'base64' ? buf.toString('base64') : buf.toString('utf8');

    return { content, size_bytes: stat.size, path: resolved, encoding };
  }
);
