/**
 * @fileoverview system.echo@1.0.0 — deterministic echo tool.
 *
 * Returns the input payload unchanged.
 * No side effects. No tenant required. Used for smoke testing.
 */

import { registerTool } from '../registry.js';
import type { InvocationContext } from '../../types/index.js';
import { z } from 'zod';

registerTool(
  {
    name: 'system.echo',
    version: '1.0.0',
    description: 'Returns the input payload unchanged. Used for testing and smoke checks.',
    inputSchema: z.object({
      payload: z.any().describe('Any JSON value to echo back'),
    }),
    outputSchema: z.object({
      payload: z.any().describe('The echoed payload'),
      echoed_at: z.string().describe('ISO timestamp'),
    }),
    deterministic: true,
    sideEffect: false,
    idempotent: true,
    requiredCapabilities: [],
    tenantScoped: false,
  },
  async (_ctx: InvocationContext, input: unknown) => {
    const { payload } = input as { payload: unknown };
    return {
      payload,
      echoed_at: new Date().toISOString(),
    };
  }
);
