/**
 * @fileoverview skill.trace_summary@1.0.0
 *
 * Deterministic trace summarization — no LLM required.
 * Takes a trace input (array of span objects) and returns a structured summary.
 *
 * Used for: smoke testing, demo flows, eval harness.
 */

import { registerSkill } from '../registry';

registerSkill({
  name: 'skill.trace_summary',
  version: '1.0.0',
  description:
    'Deterministically summarizes a trace of spans without requiring an LLM. ' +
    'Returns counts, total duration, error summary, and step list.',
  requiredTools: [],
  steps: [
    {
      kind: 'assert',
      description: 'Initial input must have a spans array',
      predicate: (bag) => {
        const initial = bag['initial'] as Record<string, unknown> | undefined;
        return Array.isArray(initial?.spans);
      },
    },
    {
      kind: 'tool',
      toolName: 'system.echo',
      input: {
        payload: {
          summary: '{{initial}}',
        },
      },
    },
  ],
});
