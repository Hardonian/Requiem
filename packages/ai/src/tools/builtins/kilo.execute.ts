/**
 * @fileoverview Kilo code integration tool.
 *
 * INVARIANT: Kilo runs in sandbox — never directly executes on the host.
 * INVARIANT: Returns diff only — never commits directly.
 * INVARIANT: Patch size is limited to prevent DoS rewrites.
 * INVARIANT: Shell execution is disabled unless explicitly allowed by policy.
 * INVARIANT: All target files must be within workspace root.
 * INVARIANT: Requiem (not Kilo) applies diffs after validation.
 *
 * Mode: diff | full_file | patch
 */

import { registerTool } from '../registry.js';
import { sandboxPath } from '../sandbox.js';
import { AiError } from '../../errors/AiError.js';
import { AiErrorCode } from '../../errors/codes.js';
import { logger } from '../../telemetry/logger.js';

const WORKSPACE_ROOT = process.env['REQUIEM_WORKSPACE_ROOT'] ?? process.cwd();
const MAX_PATCH_LINES = 2000;
const MAX_TASK_LENGTH = 10_000;

/** Validate that all target files are within sandbox. */
function validateTargetFiles(files: string[]): string[] {
  return files.map(f => sandboxPath(f, WORKSPACE_ROOT));
}

registerTool(
  {
    name: 'kilo.execute',
    version: '1.0.0',
    description: 'Execute a Kilo code task in sandbox mode. Returns a diff/patch for Requiem to validate and apply — never commits directly.',
    deterministic: false, // LLM-powered — non-deterministic
    sideEffect: false, // Kilo only PRODUCES output; Requiem applies it after validation
    idempotent: false,
    tenantScoped: true,
    requiredCapabilities: ['tools:write', 'ai:generate'],
    inputSchema: {
      type: 'object',
      required: ['task', 'target_files', 'mode'],
      properties: {
        task: {
          type: 'string',
          description: 'Natural language coding task',
          maxLength: MAX_TASK_LENGTH,
        },
        target_files: {
          type: 'array',
          items: { type: 'string', maxLength: 4096 },
          description: 'Files to operate on (must be within workspace root)',
          maxItems: 20,
        },
        mode: {
          type: 'string',
          enum: ['diff', 'full_file', 'patch'],
          description: 'Output mode: diff (unified diff), full_file (replace entire file), patch (patch format)',
        },
        context_files: {
          type: 'array',
          items: { type: 'string', maxLength: 4096 },
          description: 'Additional files to include as context (read-only)',
          maxItems: 10,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['output', 'mode', 'validation_required'],
      properties: {
        output: { type: 'string' },
        mode: { type: 'string' },
        patch_lines: { type: 'number' },
        validation_required: { type: 'boolean' },
        target_files: { type: 'array', items: { type: 'string' } },
        truncated: { type: 'boolean' },
      },
    },
  },
  async (ctx, input) => {
    const { task, target_files, mode, context_files = [] } = input as {
      task: string;
      target_files: string[];
      mode: 'diff' | 'full_file' | 'patch';
      context_files?: string[];
    };

    // Validate all paths are within sandbox
    const resolvedTargets = validateTargetFiles(target_files);
    const resolvedContext = validateTargetFiles(context_files);

    logger.info('[kilo.execute] task received', {
      task: task.slice(0, 100),
      mode,
      target_count: resolvedTargets.length,
      tenant_id: ctx.tenant.tenantId,
      trace_id: ctx.traceId,
    });

    // Shell execution guard: REQUIEM_KILO_ALLOW_SHELL must be explicitly set
    const shellAllowed = process.env['REQUIEM_KILO_ALLOW_SHELL'] === 'true';
    if (!shellAllowed && task.match(/\b(exec|spawn|fork|shell|bash|sh|cmd|powershell)\b/i)) {
      throw new AiError({
        code: AiErrorCode.SANDBOX_WRITE_DENIED,
        message: 'Task appears to request shell execution, which is disabled by policy. Set REQUIEM_KILO_ALLOW_SHELL=true to enable.',
        phase: 'kilo.execute',
      });
    }

    // Build file context for the task
    const { readFileSync, existsSync } = await import('fs');
    const fileContexts: string[] = [];

    for (const file of resolvedTargets) {
      if (existsSync(file)) {
        try {
          const content = readFileSync(file, 'utf8');
          fileContexts.push(`=== ${file} ===\n${content}`);
        } catch {
          fileContexts.push(`=== ${file} === [unreadable]`);
        }
      } else {
        fileContexts.push(`=== ${file} === [new file]`);
      }
    }

    for (const file of resolvedContext) {
      if (existsSync(file)) {
        try {
          const content = readFileSync(file, 'utf8');
          fileContexts.push(`=== ${file} (context) ===\n${content}`);
        } catch { /* skip */ }
      }
    }

    // NOTE: In production, this would delegate to the Kilo service/LLM.
    // The sandbox contract is: receive task + file context, return diff only.
    // The actual Kilo integration is wired via the model router.
    // Here we produce a structured output envelope for Requiem to validate.

    const { routeModelCall } = await import('../../models/router.js');

    const systemPrompt = `You are a code editor assistant (Kilo). Your job is to produce code changes ONLY.
Output format: ${mode === 'diff' ? 'unified diff' : mode === 'patch' ? 'patch format' : 'full file contents'}.
RULES:
1. Never execute shell commands
2. Never access files outside the provided context
3. Output ONLY the requested format, no explanations
4. Keep changes minimal and targeted
5. Maximum output: ${MAX_PATCH_LINES} lines`;

    const userPrompt = `Task: ${task}

File context:
${fileContexts.join('\n\n')}

Produce a ${mode} output implementing the task.`;

    let kilo_output: string;
    try {
      const response = await routeModelCall({
        messages: [{ role: 'user', content: userPrompt }],
        model: process.env['REQUIEM_KILO_MODEL'] ?? 'anthropic/claude-3-5-sonnet',
        systemPrompt,
        maxTokens: 4096,
        temperature: 0, // Deterministic
        ctx,
      });
      kilo_output = response.text;
    } catch (err) {
      const aiErr = AiError.fromUnknown(err, 'kilo.execute');
      logger.warn('[kilo.execute] model call failed', { error: aiErr.message });
      throw aiErr;
    }

    // Patch size limit
    const lines = kilo_output.split('\n');
    let truncated = false;
    if (lines.length > MAX_PATCH_LINES) {
      kilo_output = lines.slice(0, MAX_PATCH_LINES).join('\n');
      truncated = true;
      logger.warn('[kilo.execute] output truncated', {
        original_lines: lines.length,
        max: MAX_PATCH_LINES,
      });
    }

    return {
      output: kilo_output,
      mode,
      patch_lines: Math.min(lines.length, MAX_PATCH_LINES),
      validation_required: true, // Requiem MUST validate before applying
      target_files: resolvedTargets,
      truncated,
    };
  }
);
