/**
 * @fileoverview system.echo@1.0.0 — deterministic echo tool.
 *
 * Returns the input payload unchanged.
 * No side effects. No tenant required. Used for smoke testing.
 */

import { registerTool } from '../registry.js';

registerTool(
  {
    name: 'system.echo',
    version: '1.0.0',
    description: 'Returns the input payload unchanged. Used for testing and smoke checks.',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { description: 'Any JSON value to echo back' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['payload', 'echoed_at'],
      properties: {
        payload: { description: 'The echoed payload' },
        echoed_at: { type: 'string', description: 'ISO timestamp' },
      },
    },
    deterministic: true,
    sideEffect: false,
    idempotent: true,
    requiredCapabilities: [],
    tenantScoped: false,
  },
  async (_ctx, input: unknown) => {
    const { payload } = input as { payload: unknown };
    return {
      payload,
      echoed_at: new Date().toISOString(),
    };
  }
);
