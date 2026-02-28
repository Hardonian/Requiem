/**
 * @fileoverview Tools for interacting with the Requiem datastore.
 *
 * This file wraps the repository methods from the CLI package as formal AI tools,
 * ensuring they are schema-validated and ready for policy-gated invocation.
 */

import { z } from 'zod';
import {
  DecisionRepository,
  JunctionRepository,
  ActionIntentRepository,
} from '@requiem/cli'; // Assuming this import path works in the monorepo
import { registerTool } from './registry';

// #region: DecisionRepository Tools

const DecisionReportSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  source_type: z.string(),
  source_ref: z.string(),
  input_fingerprint: z.string(),
  decision_input: z.string(), // JSON string
  decision_output: z.string().nullable(), // JSON string
  decision_trace: z.string().nullable(), // JSON string
  recommended_action_id: z.string().nullable(),
  status: z.enum(['pending', 'evaluated', 'accepted', 'rejected', 'reviewed']),
  outcome_status: z.enum(['success', 'failure', 'mixed', 'unknown']).nullable(),
  outcome_notes: z.string().nullable(),
  calibration_delta: z.number().nullable(),
});

registerTool(
  {
    name: 'datastore_decision_create',
    version: '1.0.0',
    description: 'Creates a new decision report in the database.',
    inputSchema: z.object({
        source_type: z.string(),
        source_ref: z.string(),
        input_fingerprint: z.string(),
        decision_input: z.any(),
        decision_output: z.any().optional(),
        decision_trace: z.any().optional(),
        recommended_action_id: z.string().optional(),
        status: z.enum(['pending', 'evaluated', 'accepted', 'rejected', 'reviewed']).optional(),
    }),
    outputSchema: DecisionReportSchema,
    sideEffect: true,
  },
  async (input) => DecisionRepository.create(input)
);

registerTool(
  {
    name: 'datastore_decision_findById',
    version: '1.0.0',
    description: 'Finds a decision report by its unique ID.',
    inputSchema: z.object({ id: z.string() }),
    outputSchema: DecisionReportSchema.optional(),
    deterministic: true,
    sideEffect: false,
  },
  async ({ id }) => DecisionRepository.findById(id)
);

registerTool(
  {
    name: 'datastore_decision_update',
    version: '1.0.0',
    description: 'Updates an existing decision report.',
    inputSchema: z.object({
      id: z.string(),
      update: z.object({
        outcome_status: z.enum(['success', 'failure', 'mixed']).optional(),
        outcome_notes: z.string().nullable().optional(),
        calibration_delta: z.number().nullable().optional(),
        status: z.enum(['pending', 'evaluated', 'accepted', 'rejected', 'reviewed']).optional(),
      }),
    }),
    outputSchema: DecisionReportSchema.optional(),
    sideEffect: true,
  },
  async ({ id, update }) => DecisionRepository.update(id, update)
);

registerTool(
  {
    name: 'datastore_decision_list',
    version: '1.0.0',
    description: 'Lists decision reports with optional filters.',
    inputSchema: z
      .object({
        sourceType: z.string().optional(),
        status: z.string().optional(),
        outcomeStatus: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    outputSchema: z.array(DecisionReportSchema),
    deterministic: true,
    sideEffect: false,
  },
  async (input) => DecisionRepository.list(input)
);

registerTool(
  {
    name: 'datastore_decision_delete',
    version: '1.0.0',
    description: 'Deletes a decision report by its ID.',
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.boolean(),
    sideEffect: true,
  },
  async ({ id }) => DecisionRepository.delete(id)
);

// #endregion: DecisionRepository Tools

const JunctionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  junction_type: z.enum(['diff_critical', 'drift_alert', 'trust_drop', 'policy_violation']),
  severity_score: z.number(),
  fingerprint: z.string(),
  source_type: z.enum(['diff', 'drift', 'policy', 'trust']),
  source_ref: z.string(),
  trigger_data: z.string(), // JSON string
  trigger_trace: z.string(), // JSON string
  cooldown_until: z.string().nullable(),
  deduplication_key: z.string().nullable(),
  decision_report_id: z.string().nullable(),
  status: z.enum(['active', 'resolved', 'suppressed']),
});

registerTool(
    {
        name: 'datastore_junction_create',
        version: '1.0.0',
        description: 'Creates a new junction in the database.',
        inputSchema: z.object({
            junction_type: z.enum(['diff_critical', 'drift_alert', 'trust_drop', 'policy_violation']),
            severity_score: z.number(),
            fingerprint: z.string(),
            source_type: z.enum(['diff', 'drift', 'policy', 'trust']),
            source_ref: z.string(),
            trigger_data: z.record(z.any()),
            trigger_trace: z.record(z.any()),
            deduplication_key: z.string().optional(),
            cooldown_hours: z.number().optional(),
        }),
        outputSchema: JunctionSchema,
        sideEffect: true,
    },
    async (input) => JunctionRepository.create(input)
);

registerTool(
    {
        name: 'datastore_junction_findById',
        version: '1.0.0',
        description: 'Finds a junction by its unique ID.',
        inputSchema: z.object({ id: z.string() }),
        outputSchema: JunctionSchema.optional(),
        deterministic: true,
        sideEffect: false,
    },
    async ({ id }) => JunctionRepository.findById(id)
);

registerTool(
    {
        name: 'datastore_junction_findByFingerprint',
        version: '1.0.0',
        description: 'Finds junctions by fingerprint.',
        inputSchema: z.object({ fingerprint: z.string() }),
        outputSchema: z.array(JunctionSchema),
        deterministic: true,
        sideEffect: false,
    },
    async ({ fingerprint }) => JunctionRepository.findByFingerprint(fingerprint)
);

registerTool(
    {
        name: 'datastore_junction_findByDeduplicationKey',
        version: '1.0.0',
        description: 'Finds a junction by deduplication key.',
        inputSchema: z.object({ key: z.string() }),
        outputSchema: JunctionSchema.optional(),
        deterministic: true,
        sideEffect: false,
    },
    async ({ key }) => JunctionRepository.findByDeduplicationKey(key)
);

registerTool(
    {
        name: 'datastore_junction_isInCooldown',
        version: '1.0.0',
        description: 'Checks if a junction with the given deduplication key exists and is not in cooldown.',
        inputSchema: z.object({ deduplicationKey: z.string() }),
        outputSchema: z.boolean(),
        deterministic: true,
        sideEffect: false,
    },
    async ({ deduplicationKey }) => JunctionRepository.isInCooldown(deduplicationKey)
);

registerTool(
    {
        name: 'datastore_junction_update',
        version: '1.0.0',
        description: 'Updates an existing junction.',
        inputSchema: z.object({
            id: z.string(),
            update: z.any(), // This should be improved with a more specific schema
        }),
        outputSchema: JunctionSchema.optional(),
        sideEffect: true,
    },
    async ({ id, update }) => JunctionRepository.update(id, update)
);

registerTool(
    {
        name: 'datastore_junction_linkToDecision',
        version: '1.0.0',
        description: 'Links a junction to a decision report.',
        inputSchema: z.object({
            junctionId: z.string(),
            decisionReportId: z.string(),
        }),
        outputSchema: JunctionSchema.optional(),
        sideEffect: true,
    },
    async ({ junctionId, decisionReportId }) => JunctionRepository.linkToDecision(junctionId, decisionReportId)
);

registerTool(
    {
        name: 'datastore_junction_resolve',
        version: '1.0.0',
        description: 'Resolves a junction.',
        inputSchema: z.object({ id: z.string() }),
        outputSchema: JunctionSchema.optional(),
        sideEffect: true,
    },
    async ({ id }) => JunctionRepository.resolve(id)
);

registerTool(
    {
        name: 'datastore_junction_suppress',
        version: '1.0.0',
        description: 'Suppresses a junction.',
        inputSchema: z.object({ id: z.string() }),
        outputSchema: JunctionSchema.optional(),
        sideEffect: true,
    },
    async ({ id }) => JunctionRepository.suppress(id)
);

registerTool(
    {
        name: 'datastore_junction_list',
        version: '1.0.0',
        description: 'Lists junctions with optional filters.',
        inputSchema: z.object({
            junctionType: z.string().optional(),
            sourceType: z.string().optional(),
            status: z.string().optional(),
            minSeverity: z.number().optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
        }).optional(),
        outputSchema: z.array(JunctionSchema),
        deterministic: true,
        sideEffect: false,
    },
    async (input) => JunctionRepository.list(input)
);
// #endregion

const ActionIntentSchema = z.object({
    id: z.string(),
    created_at: z.string(),
    decision_report_id: z.string(),
    action_type: z.string(),
    action_payload: z.string(), // JSON string
    status: z.enum(['pending', 'executed', 'failed', 'cancelled']),
    executed_at: z.string().nullable(),
    execution_result: z.string().nullable(),
});

registerTool(
    {
        name: 'datastore_actionIntent_create',
        version: '1.0.0',
        description: 'Creates a new action intent.',
        inputSchema: z.object({
            decision_report_id: z.string(),
            action_type: z.string(),
            action_payload: z.record(z.any()),
        }),
        outputSchema: ActionIntentSchema,
        sideEffect: true,
    },
    async (input) => ActionIntentRepository.create(input)
);

registerTool(
    {
        name: 'datastore_actionIntent_findByDecisionReport',
        version: '1.0.0',
        description: 'Finds action intents by decision report ID.',
        inputSchema: z.object({ decisionReportId: z.string() }),
        outputSchema: z.array(ActionIntentSchema),
        deterministic: true,
        sideEffect: false,
    },
    async ({ decisionReportId }) => ActionIntentRepository.findByDecisionReport(decisionReportId)
);

registerTool(
    {
        name: 'datastore_actionIntent_markExecuted',
        version: '1.0.0',
        description: 'Marks an action intent as executed.',
        inputSchema: z.object({
            id: z.string(),
            result: z.record(z.any()),
        }),
        outputSchema: ActionIntentSchema.optional(),
        sideEffect: true,
    },
    async ({ id, result }) => ActionIntentRepository.markExecuted(id, result)
);

registerTool(
    {
        name: 'datastore_actionIntent_markFailed',
        version: '1.0.0',
        description: 'Marks an action intent as failed.',
        inputSchema: z.object({
            id: z.string(),
            error: z.string(),
        }),
        outputSchema: ActionIntentSchema.optional(),
        sideEffect: true,
    },
    async ({ id, error }) => ActionIntentRepository.markFailed(id, error)
);

registerTool(
    {
        name: 'datastore_actionIntent_cancel',
        version: '1.0.0',
        description: 'Cancels an action intent.',
        inputSchema: z.object({ id: z.string() }),
        outputSchema: ActionIntentSchema.optional(),
        sideEffect: true,
    },
    async ({ id }) => ActionIntentRepository.cancel(id)
);
// #endregion

const ActionIntentSchema = z.object({
    id: z.string(),
    created_at: z.string(),
    decision_report_id: z.string(),
    action_type: z.string(),
    action_payload: z.string(), // JSON string
    status: z.enum(['pending', 'executed', 'failed', 'cancelled']),
    executed_at: z.string().nullable(),
    execution_result: z.string().nullable(),
});

registerTool(
    {
        name: 'datastore_actionIntent_create',
        version: '1.0.0',
        description: 'Creates a new action intent.',
        inputSchema: z.object({
            decision_report_id: z.string(),
            action_type: z.string(),
            action_payload: z.record(z.any()),
        }),
        outputSchema: ActionIntentSchema,
        sideEffect: true,
    },
    async (input) => ActionIntentRepository.create(input)
);

registerTool(
    {
        name: 'datastore_actionIntent_findByDecisionReport',
        version: '1.0.0',
        description: 'Finds action intents by decision report ID.',
        inputSchema: z.object({ decisionReportId: z.string() }),
        outputSchema: z.array(ActionIntentSchema),
        deterministic: true,
        sideEffect: false,
    },
    async ({ decisionReportId }) => ActionIntentRepository.findByDecisionReport(decisionReportId)
);

registerTool(
    {
        name: 'datastore_actionIntent_markExecuted',
        version: '1.0.0',
        description: 'Marks an action intent as executed.',
        inputSchema: z.object({
            id: z.string(),
            result: z.record(z.any()),
        }),
        outputSchema: ActionIntentSchema.optional(),
        sideEffect: true,
    },
    async ({ id, result }) => ActionIntentRepository.markExecuted(id, result)
);

registerTool(
    {
        name: 'datastore_actionIntent_markFailed',
        version: '1.0.0',
        description: 'Marks an action intent as failed.',
        inputSchema: z.object({
            id: z.string(),
            error: z.string(),
        }),
        outputSchema: ActionIntentSchema.optional(),
        sideEffect: true,
    },
    async ({ id, error }) => ActionIntentRepository.markFailed(id, error)
);

registerTool(
    {
        name: 'datastore_actionIntent_cancel',
        version: '1.0.0',
        description: 'Cancels an action intent.',
        inputSchema: z.object({ id: z.string() }),
        outputSchema: ActionIntentSchema.optional(),
        sideEffect: true,
    },
    async ({ id }) => ActionIntentRepository.cancel(id)
);
// #endregion
