/**
 * @fileoverview Baseline skills for the Requiem AI system.
 */

import { z } from 'zod';
import { registerSkill } from './registry';

// #region: Trace Summary Skill

registerSkill({
  name: 'trace_summary',
  version: '1.0.0',
  description: 'Summarizes a canonical log trace.',
  requiredTools: [],
  steps: [
    {
      kind: 'llm',
      prompt: 'Summarize the following trace: {{initial.trace}}',
    },
  ],
});

// #endregion

// #region: Root Cause Investigation Skill

registerSkill({
  name: 'root_cause_investigation',
  version: '1.0.0',
  description: 'Investigates a junction to identify the root cause.',
  requiredTools: ['datastore_junction_findById', 'datastore_decision_findById'],
  steps: [
    {
      kind: 'tool',
      toolName: 'datastore_junction_findById',
      input: { id: '{{initial.junctionId}}' },
    },
    {
      kind: 'tool',
      toolName: 'datastore_decision_findById',
      input: { id: '{{datastore_junction_findById.decision_report_id}}' },
    },
    {
        kind: 'llm',
        prompt: `
        Investigate the root cause of the following junction and decision.
        Junction: {{datastore_junction_findById}}
        Decision: {{datastore_decision_findById}}
        `,
    }
  ],
});

// #endregion

// #region: Policy Decision Explain Skill

registerSkill({
    name: 'policy_decision_explain',
    version: '1.0.0',
    description: 'Explains why a policy decision was made.',
    requiredTools: [],
    steps: [
        {
            kind: 'llm',
            prompt: `
            Explain the following policy decision in simple terms.
            Decision: {{initial.decision}}
            `,
        },
    ],
});

// #endregion
