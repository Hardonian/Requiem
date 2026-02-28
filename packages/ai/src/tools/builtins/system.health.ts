/**
 * @fileoverview system.health@1.0.0 — returns AI layer config status.
 *
 * Deterministic. No side effects. No secrets exposed.
 * Used by operations and verify scripts to confirm the AI layer is live.
 */

import { registerTool } from '../registry.js';
import { getToolCount } from '../registry.js';
import type { InvocationContext } from '../../types/index.js';

registerTool(
  {
    name: 'system.health',
    version: '1.0.0',
    description: 'Returns AI control-plane health and configuration status. No secrets exposed.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        version: { type: 'string' },
        tools_registered: { type: 'integer' },
        timestamp: { type: 'string' },
        environment: { type: 'string' },
      },
      required: ['status', 'version', 'tools_registered', 'timestamp'],
    },
    deterministic: false, // depends on runtime state
    sideEffect: false,
    idempotent: true,
    requiredCapabilities: [],
    tenantScoped: false,
  },
  async (ctx: InvocationContext, _input: unknown) => {
    return {
      status: 'ok',
      version: '0.1.0',
      tools_registered: getToolCount(),
      timestamp: new Date().toISOString(),
      environment: ctx.environment,
    };
  }
);
