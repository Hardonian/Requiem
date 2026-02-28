/**
 * @fileoverview system.health@1.0.0 — returns AI layer config status.
 *
 * Deterministic. No side effects. No secrets exposed.
 * Used by operations and verify scripts to confirm the AI layer is live.
 */

import { registerTool, getToolCount } from '../registry';
import type { InvocationContext } from '../../types/index';
import { z } from 'zod';

registerTool(
  {
    name: 'system.health',
    version: '1.0.0',
    description: 'Returns AI control-plane health and configuration status. No secrets exposed.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      status: z.enum(['ok', 'degraded']),
      version: z.string(),
      tools_registered: z.number(),
      timestamp: z.string(),
      environment: z.string(),
    }),
    deterministic: false, // depends on runtime state
    sideEffect: false,
    idempotent: true,
    requiredCapabilities: [],
    tenantScoped: false,
  },
  async (ctx: InvocationContext, _input: unknown) => {
    return {
      status: 'ok' as const,
      version: '0.1.0',
      tools_registered: getToolCount(),
      timestamp: new Date().toISOString(),
      environment: ctx.environment,
    };
  }
);
