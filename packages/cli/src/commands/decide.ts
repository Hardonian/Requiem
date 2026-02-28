/**
 * Decide CLI Module
 *
 * Commands:
 * - requiem decide evaluate --junction <id>
 * - requiem decide explain --junction <id>
 * - requiem decide outcome --id <id> --status success|failure|mixed --notes
 */

import { ActionIntentRepository, JunctionRepository, Junction } from '../db/junctions';
import { evaluateDecision } from '../engine/adapter';
import type { DecisionInput, DecisionOutput } from '../lib/fallback';
import { DecisionRepository, DecisionReport, CalibrationRepository } from '../db/decisions';

export interface DecisionReportOutput {
  id: string;
  source_type: string;
  source_ref: string;
  status: string;
  outcome_status: string | null;
  recommended_action_id: string | null;
  input_fingerprint: string;
  created_at: string;
  updated_at: string;
  decision_input? : string;
  decision_output?: string | null;
  decision_trace?: string | null;
  outcome_notes?: string | null;
  calibration_delta?: number | null;
}

export interface DecideCliArgs {
  command: 'evaluate' | 'explain' | 'outcome' | 'list' | 'show';
  tenantId?: string;
  junctionId?: string;
  decisionId?: string;
  status?: 'success' | 'failure' | 'mixed' | 'unknown';
  notes?: string;
  json?: boolean;
}

export function parseDecideArgs(argv: string[]): DecideCliArgs {
  const result: DecideCliArgs = {
    command: 'list',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === 'evaluate') {
      result.command = 'evaluate';
    } else if (arg === 'explain') {
      result.command = 'explain';
    } else if (arg === 'outcome') {
      result.command = 'outcome';
    } else if (arg === 'list') {
      result.command = 'list';
    } else if (arg === 'show') {
      result.command = 'show';
      if (next && !next.startsWith('--')) {
        result.decisionId = next;
        i++;
      }
    } else if (arg === '--junction' && next) {
      result.junctionId = next;
      i++;
    } else if (arg === '--tenant' && next) {
      result.tenantId = next;
      i++;
    } else if (arg === '--id' && next) {
      result.decisionId = next;
      i++;
    } else if (arg === '--status' && next) {
      result.status = next as DecideCliArgs['status'];
      i++;
    } else if (arg === '--notes' && next) {
      result.notes = next;
      i++;
    } else if (arg === '--json') {
      result.json = true;
    }
  }

  return result;
}

/**
 * Run the decide CLI command
 */
export async function runDecideCommand(args: DecideCliArgs): Promise<number> {
  try {
    const { requireTenantContextCli, getGlobalTenantResolver } = await import('../lib/tenant');
    const context = await requireTenantContextCli(getGlobalTenantResolver(), {
      ...process.env,
      REQUIEM_TENANT_ID: args.tenantId || process.env.REQUIEM_TENANT_ID,
    });

    switch (args.command) {
      case 'evaluate':
        return await handleEvaluate(args, context.tenantId);
      case 'explain':
        return await handleExplain(args, context.tenantId);
      case 'outcome':
        return await handleOutcome(args, context.tenantId);
      case 'list':
        return await handleList(args, context.tenantId);
      case 'show':
        return await handleShow(args, context.tenantId);
      default:
        console.error(`Unknown command: ${args.command}`);
        return 1;
    }
  } catch (error) {
    if (args.json) {
      console.error(JSON.stringify({
        error: (error as Error).message,
        code: 'E_INTERNAL',
      }));
    } else {
      console.error(`Error: ${(error as Error).message}`);
    }
    return 1;
  }
}

async function handleEvaluate(args: DecideCliArgs, tenantId: string): Promise<number> {
  if (!args.junctionId) {
    console.error('Error: --junction <id> is required');
    return 1;
  }

  const junction = JunctionRepository.findById(args.junctionId, tenantId);
  if (!junction) {
    if (args.json) {
      console.log(JSON.stringify({
        error: 'Junction not found',
        code: 'E_NOT_FOUND',
        id: args.junctionId,
      }));
    } else {
      console.log(`Junction not found: ${args.junctionId}`);
    }
    return 1;
  }

  // Parse trigger data to build decision input
  const triggerData = JSON.parse(junction.trigger_data);

  // v1.2: Automate feedback of calibration_delta into the decide adapter.
  // Retrieve historical bias for this source type.
  const bias = CalibrationRepository.getAverageDelta(tenantId, junction.source_type);

  // Build a simple decision input from the junction data
  const decisionInput: DecisionInput = {
    actions: ['accept', 'reject', 'defer', 'investigate'],
    states: ['critical', 'high', 'medium', 'low'],
    outcomes: buildOutcomeMatrix(triggerData, junction.severity_score),
    weights: { calibration_bias: bias },
    algorithm: 'minimax_regret',
  };

  const result = await evaluateDecision(decisionInput);

  // Create decision report
  const decisionReport = DecisionRepository.create({
    tenant_id: tenantId,
    source_type: junction.source_type,
    source_ref: junction.source_ref,
    input_fingerprint: junction.fingerprint,
    decision_input: decisionInput,
    decision_output: result,
    decision_trace: result.trace,
    recommended_action_id: result.recommended_action,
    status: 'evaluated',
  });

  // Link junction to decision
  JunctionRepository.linkToDecision(junction.id, decisionReport.id);

  if (args.json) {
    console.log(JSON.stringify({
      command: 'evaluate',
      decisionReport: formatDecisionReport(decisionReport),
      evaluation: result,
    }, null, 2));
  } else {
    console.log(`\n=== Decision Evaluation ===\n`);
    console.log(`Junction: ${junction.junction_type}`);
    console.log(`Severity: ${junction.severity_score.toFixed(2)}`);
    console.log(`\nRecommended Action: ${result.recommended_action}`);
    console.log(`\nRanking:`);
    result.ranking.forEach((action, idx) => {
      console.log(`  ${idx + 1}. ${action}`);
    });
    console.log(`\nDecision Report ID: ${decisionReport.id}`);
  }

  return 0;
}

async function handleExplain(args: DecideCliArgs, tenantId: string): Promise<number> {
  if (!args.junctionId) {
    console.error('Error: --junction <id> is required');
    return 1;
  }

  const junction = JunctionRepository.findById(args.junctionId, tenantId);
  if (!junction) {
    if (args.json) {
      console.log(JSON.stringify({
        error: 'Junction not found',
        code: 'E_NOT_FOUND',
        id: args.junctionId,
      }));
    } else {
      console.log(`Junction not found: ${args.junctionId}`);
    }
    return 1;
  }

  const triggerTrace = JSON.parse(junction.trigger_trace);
  const triggerData = JSON.parse(junction.trigger_data);

  if (args.json) {
    console.log(JSON.stringify({
      command: 'explain',
      junctionId: junction.id,
      type: junction.junction_type,
      sourceRef: junction.source_ref,
      severityScore: junction.severity_score,
      explanation: generateExplanation(junction, triggerTrace, triggerData),
      trace: triggerTrace,
    }, null, 2));
  } else {
    console.log(`\n=== Decision Explanation ===\n`);
    console.log(`Junction: ${junction.junction_type}`);
    console.log(`Severity Score: ${junction.severity_score.toFixed(2)}`);
    console.log(`\n--- Why This Action Won ---`);

    const explanation = generateExplanation(junction, triggerTrace, triggerData);
    console.log(explanation.summary);

    console.log(`\n--- Trigger Trace ---`);
    console.log(JSON.stringify(triggerTrace, null, 2));
  }

  return 0;
}

async function handleOutcome(args: DecideCliArgs, tenantId: string): Promise<number> {
  if (!args.decisionId) {
    console.error('Error: --id <decisionId> is required');
    return 1;
  }

  if (!args.status) {
    console.error('Error: --status success|failure|mixed is required');
    return 1;
  }

  const decision = DecisionRepository.findById(args.decisionId, tenantId);
  if (!decision) {
    if (args.json) {
      console.log(JSON.stringify({
        error: 'Decision not found',
        code: 'E_NOT_FOUND',
        id: args.decisionId,
      }));
    } else {
      console.log(`Decision not found: ${args.decisionId}`);
    }
    return 1;
  }

  // Calculate calibration delta if there was a predicted outcome
  let calibrationDelta: number | null = null;
  if (decision.decision_output) {
    const output = JSON.parse(decision.decision_output) as DecisionOutput;
    const predictedScore = getPredictedScore(output);
    const actualScore = args.status === 'success' ? 1.0 : args.status === 'failure' ? 0.0 : 0.5;
    calibrationDelta = actualScore - predictedScore;
  }

  // Update decision with outcome
  DecisionRepository.update(args.decisionId, {
    outcome_status: args.status as 'success' | 'failure' | 'mixed',
    outcome_notes: args.notes || null,
    calibration_delta: calibrationDelta,
    status: args.status === 'success' ? 'accepted' : args.status === 'failure' ? 'rejected' : 'reviewed',
  });

  if (args.json) {
    console.log(JSON.stringify({
      command: 'outcome',
      decisionId: args.decisionId,
      status: args.status,
      notes: args.notes,
      calibrationDelta,
      message: 'Outcome recorded successfully',
    }, null, 2));
  } else {
    console.log(`\n=== Outcome Recorded ===\n`);
    console.log(`Decision ID: ${args.decisionId}`);
    console.log(`Status: ${args.status}`);
    if (args.notes) {
      console.log(`Notes: ${args.notes}`);
    }
    if (calibrationDelta !== null) {
      console.log(`Calibration Delta: ${calibrationDelta.toFixed(4)}`);
    }
    console.log(`\nOutcome recorded successfully.`);
  }

  return 0;
}

async function handleList(args: DecideCliArgs, tenantId: string): Promise<number> {
  const decisions = DecisionRepository.list({
    tenantId,
    limit: 50,
  });

  if (args.json) {
    console.log(JSON.stringify({
      command: 'list',
      count: decisions.length,
      decisions: decisions.map(d => formatDecisionReport(d)),
    }, null, 2));
  } else {
    console.log(`\n=== Decision Reports ===\n`);
    console.log(`Total: ${decisions.length} decision(s)\n`);

    for (const decision of decisions) {
      const output = formatDecisionReport(decision);
      console.log(`[${(output.status as string).toUpperCase()}] ${output.id}`);
      console.log(`  Source: ${output.source_type}:${output.source_ref}`);
      console.log(`  Recommended: ${output.recommended_action_id || 'N/A'}`);
      console.log(`  Outcome: ${output.outcome_status || 'unknown'}`);
      console.log('');
    }
  }

  return 0;
}

async function handleShow(args: DecideCliArgs, tenantId: string): Promise<number> {
  if (!args.decisionId) {
    console.error('Error: Decision ID is required');
    return 1;
  }

  const decision = DecisionRepository.findById(args.decisionId, tenantId);
  if (!decision) {
    if (args.json) {
      console.log(JSON.stringify({
        error: 'Decision not found',
        code: 'E_NOT_FOUND',
        id: args.decisionId,
      }));
    } else {
      console.log(`Decision not found: ${args.decisionId}`);
    }
    return 1;
  }

  if (args.json) {
    console.log(JSON.stringify({
      command: 'show',
      decision: formatDecisionReport(decision, true),
    }, null, 2));
  } else {
    const output = formatDecisionReport(decision, true);
    console.log(`\n=== Decision Details ===\n`);
    console.log(`ID: ${output.id}`);
    console.log(`Source Type: ${output.source_type}`);
    console.log(`Source Ref: ${output.source_ref}`);
    console.log(`Status: ${output.status}`);
    console.log(`Outcome Status: ${output.outcome_status}`);
    console.log(`Recommended Action: ${output.recommended_action_id || 'N/A'}`);
    console.log(`Fingerprint: ${output.input_fingerprint}`);
    console.log(`Created: ${output.created_at}`);
    console.log(`Updated: ${output.updated_at}`);

    if (output.outcome_notes) {
      console.log(`\nOutcome Notes: ${output.outcome_notes}`);
    }

    if (output.calibration_delta !== null) {
      console.log(`Calibration Delta: ${output.calibration_delta}`);
    }

    console.log('\n--- Decision Input ---');
    console.log(JSON.stringify(JSON.parse((output.decision_input as string) || '{}'), null, 2));

    if (output.decision_output) {
      console.log('\n--- Decision Output ---');
      console.log(JSON.stringify(JSON.parse(output.decision_output as string), null, 2));
    }

    // Show linked action intents
    const intents = ActionIntentRepository.findByDecisionReport(decision.id);
    if (intents.length > 0) {
      console.log('\n--- Action Intents ---');
      console.log(JSON.stringify(intents, null, 2));
    }
  }

  return 0;
}

// Helper functions

function buildOutcomeMatrix(_triggerData: unknown, severity: number): Record<string, Record<string, number>> {
  // Build a simple outcome matrix based on trigger data
  return {
    accept: { critical: 1 - severity, high: 0.8, medium: 0.9, low: 1.0 },
    reject: { critical: 0.0, high: 0.2, medium: 0.4, low: 0.6 },
    defer: { critical: 0.3, high: 0.5, medium: 0.7, low: 0.8 },
    investigate: { critical: 0.5, high: 0.6, medium: 0.7, low: 0.8 },
  };
}

function getPredictedScore(output: DecisionOutput): number {
  // Simplified - in a real system this would be more sophisticated
  const rank = output.ranking.indexOf(output.recommended_action);
  return 1.0 - (rank * 0.25);
}

interface TriggerData {
  diffSummary?: {
    filesChanged?: number;
    breakingChanges?: unknown[];
  };
  driftCategory?: string;
  trend?: string;
  previousTrustScore?: number;
  currentTrustScore?: number;
  violationCount?: number;
  violationSeverity?: string;
}

function generateExplanation(junction: Junction, _triggerTrace: unknown, triggerData: Record<string, unknown>): { summary: string; factors: string[] } {
  const factors: string[] = [];
  const data = triggerData as TriggerData;

  // Add severity factor
  factors.push(`Severity score: ${junction.severity_score.toFixed(2)}`);

  // Add trigger-specific factors
  if (junction.junction_type === 'diff_critical') {
    factors.push(`Files changed: ${data.diffSummary?.filesChanged || 'N/A'}`);
    factors.push(`Breaking changes: ${data.diffSummary?.breakingChanges?.length || 0}`);
  } else if (junction.junction_type === 'drift_alert') {
    factors.push(`Drift category: ${data.driftCategory || 'N/A'}`);
    factors.push(`Trend: ${data.trend || 'N/A'}`);
  } else if (junction.junction_type === 'trust_drop') {
    factors.push(`Trust drop: ${(data.previousTrustScore as number || 0) - (data.currentTrustScore as number || 0)}`);
  } else if (junction.junction_type === 'policy_violation') {
    factors.push(`Violation count: ${data.violationCount || 0}`);
    factors.push(`Severity: ${data.violationSeverity || 'N/A'}`);
  }

  const summary = `This ${junction.junction_type} junction was triggered based on the computed severity score of ${junction.severity_score.toFixed(2)}. The decision engine recommends reviewing the evidence and taking appropriate action.`;

  return { summary, factors };
}

function formatDecisionReport(decision: DecisionReport, verbose: boolean = false): DecisionReportOutput {
  const output: DecisionReportOutput = {
    id: decision.id,
    source_type: decision.source_type,
    source_ref: decision.source_ref,
    status: decision.status,
    outcome_status: decision.outcome_status,
    recommended_action_id: decision.recommended_action_id,
    input_fingerprint: decision.input_fingerprint,
    created_at: decision.created_at,
    updated_at: decision.updated_at,
  };

  if (verbose) {
    output.decision_input = decision.decision_input;
    output.decision_output = decision.decision_output;
    output.decision_trace = decision.decision_trace;
    output.outcome_notes = decision.outcome_notes;
    output.calibration_delta = decision.calibration_delta;
  }

  return output;
}
