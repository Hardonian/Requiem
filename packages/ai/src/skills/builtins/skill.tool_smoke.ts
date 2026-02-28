/**
 * @fileoverview skill.tool_smoke@1.0.0
 *
 * Smoke test skill — runs system.echo + system.health and asserts valid responses.
 * No LLM required. Used in verify scripts and CI.
 */

import { registerSkill } from '../registry.js';

registerSkill({
  name: 'skill.tool_smoke',
  version: '1.0.0',
  description:
    'Smoke test: invokes system.echo and system.health, asserts they return valid structured responses.',
  requiredTools: ['system.echo', 'system.health'],
  steps: [
    {
      kind: 'tool',
      toolName: 'system.echo',
      outputKey: 'echo_result',
      input: { payload: { test: 'smoke', ts: Date.now() } },
    },
    {
      kind: 'assert',
      description: 'system.echo must return an object with payload field',
      predicate: (bag) => {
        const result = bag['echo_result'] as Record<string, unknown> | undefined;
        return typeof result === 'object' && result !== null && 'payload' in result;
      },
    },
    {
      kind: 'tool',
      toolName: 'system.health',
      outputKey: 'health_result',
      input: {},
    },
    {
      kind: 'assert',
      description: 'system.health must return status:ok',
      predicate: (bag) => {
        const result = bag['health_result'] as Record<string, unknown> | undefined;
        return result?.status === 'ok';
      },
    },
  ],
});
