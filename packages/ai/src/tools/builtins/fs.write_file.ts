/**
 * @fileoverview Sandboxed filesystem write tool (policy-gated).
 *
 * INVARIANT: Writes require 'tools:write' capability.
 * INVARIANT: Only writes within REQUIEM_WORKSPACE_ROOT.
 * INVARIANT: No path traversal.
 * INVARIANT: Records content hash before + after for audit trail.
 * INVARIANT: Non-deterministic (content changes disk state).
 * INVARIANT: Write whitelist enforced if REQUIEM_WRITE_WHITELIST is set.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { registerTool } from '../registry';
import { sandboxPath } from '../sandbox';
import { logger } from '../../telemetry/logger';

const MAX_WRITE_SIZE = 1_048_576; // 1 MiB
const WORKSPACE_ROOT = process.env['REQUIEM_WORKSPACE_ROOT'] ?? process.cwd();

/** Parse write whitelist from env (comma-separated glob prefixes) */
function getWriteWhitelist(): string[] | null {
  const raw = process.env['REQUIEM_WRITE_WHITELIST'];
  if (!raw) return null;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isWhitelisted(resolvedPath: string, root: string): boolean {
  const whitelist = getWriteWhitelist();
  if (!whitelist) return true; // No whitelist = allow all within sandbox
  return whitelist.some(prefix => resolvedPath.startsWith(`${root}/${prefix}`));
}

registerTool(
  {
    name: 'fs.write_file',
    version: '1.0.0',
    description: 'Write content to a file within the workspace sandbox. Policy-gated: requires tools:write capability.',
    deterministic: false, // Writes change disk state — non-deterministic
    sideEffect: true,
    idempotent: false,
    tenantScoped: true,
    requiredCapabilities: ['tools:write'],
    inputSchema: {
      type: 'object',
      required: ['path', 'content'],
      properties: {
        path: {
          type: 'string',
          description: 'Relative or absolute path within workspace root',
          maxLength: 4096,
        },
        content: {
          type: 'string',
          description: 'Content to write (UTF-8)',
          maxLength: 1_048_576,
        },
        create_dirs: {
          type: 'boolean',
          description: 'Create parent directories if missing (default: false)',
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['path', 'bytes_written', 'hash_before', 'hash_after'],
      properties: {
        path: { type: 'string' },
        bytes_written: { type: 'number' },
        hash_before: { type: 'string', nullable: true },
        hash_after: { type: 'string' },
      },
    },
  },
  async (ctx, input) => {
    const { path, content, create_dirs = false } = input as {
      path: string;
      content: string;
      create_dirs?: boolean;
    };

    // Sandbox the path
    const resolved = sandboxPath(path, WORKSPACE_ROOT);

    // Write whitelist check
    if (!isWhitelisted(resolved, WORKSPACE_ROOT)) {
      throw new Error(`Write denied: path "${path}" is not in the write whitelist`);
    }

    if (content.length > MAX_WRITE_SIZE) {
      throw new Error(`Content too large: ${content.length} bytes (max ${MAX_WRITE_SIZE})`);
    }

    // Hash before
    let hashBefore: string | null = null;
    if (existsSync(resolved)) {
      hashBefore = createHash('sha256').update(readFileSync(resolved)).digest('hex');
    }

    // Create parent directories if requested
    if (create_dirs) {
      mkdirSync(dirname(resolved), { recursive: true });
    }

    // Write
    writeFileSync(resolved, content, 'utf8');

    // Hash after
    const hashAfter = createHash('sha256').update(readFileSync(resolved)).digest('hex');

    logger.info('[fs.write_file] file written', {
      path: resolved,
      tenant_id: ctx.tenant.tenantId,
      trace_id: ctx.traceId,
      bytes: content.length,
      hash_before: hashBefore,
      hash_after: hashAfter,
    });

    return {
      path: resolved,
      bytes_written: content.length,
      hash_before: hashBefore,
      hash_after: hashAfter,
    };
  }
);
