/**
 * reach learn CLI Command
 * 
 * Outputs learning data: signals, diagnoses, proposed patches
 * 
 * Usage:
 *   reach learn --window=7d --format=table|json
 */

import { getLearningSummary, runLearningPipeline } from '../lib/learning-pipeline.js';
import { calculateSymmetry } from '../lib/symmetry-engine.js';

// ─── Argument Parsing ───────────────────────────────────────────────────────────

export interface LearnArgs {
  window?: string;
  format?: 'table' | 'json';
  tenantId?: string;
  runPipeline?: boolean;
}

export function parseLearnArgs(args: string[]): LearnArgs {
  const result: LearnArgs = {
    format: 'table',
    runPipeline: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--window' && i + 1 < args.length) {
      result.window = args[++i];
    } else if (arg === '--format' && i + 1 < args.length) {
      const format = args[++i];
      if (format === 'table' || format === 'json') {
        result.format = format;
      }
    } else if (arg === '--tenant' && i + 1 < args.length) {
      result.tenantId = args[++i];
    } else if (arg === '--run-pipeline') {
      result.runPipeline = true;
    }
  }
  
  // Default tenant ID if not provided
  if (!result.tenantId) {
    result.tenantId = process.env.REQUIEM_TENANT_ID || 'default-tenant';
  }
  
  return result;
}

// ─── Window Parser ───────────────────────────────────────────────────────────────

function parseWindow(window?: string): Date | undefined {
  if (!window) return undefined;
  
  const match = window.match(/^(\d+)([dh])$/);
  if (!match) return undefined;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const now = new Date();
  const ms = unit === 'd' ? value * 24 * 60 * 60 * 1000 : value * 60 * 60 * 1000;
  
  return new Date(now.getTime() - ms);
}

// ─── Table Output ───────────────────────────────────────────────────────────────

function printTableSummary(
  tenantId: string,
  summary: ReturnType<typeof getLearningSummary>,
  symmetry: ReturnType<typeof calculateSymmetry>
): void {
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log(`│ LEARNING SUMMARY — Tenant: ${tenantId.padEnd(43)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  
  // Signal counts
  console.log('│ SIGNALS BY CATEGORY                                                │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  for (const [category, count] of Object.entries(summary.signalCounts)) {
    console.log(`│   ${category.padEnd(25)} ${String(count).padStart(10)}`.padEnd(64) + '│');
  }
  
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Diagnoses: ${summary.diagnosisCount.toString().padEnd(54)}│`);
  console.log(`│ Patches:   ${summary.patchCount.toString().padEnd(54)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  
  // Proposed patches
  console.log('│ PROPOSED PATCHES                                                   │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  if (summary.proposedPatches.length === 0) {
    console.log('│   (none)                                                           │');
  } else {
    for (const patch of summary.proposedPatches.slice(0, 5)) {
      console.log(`│   ${patch.id.substring(0, 8)}... ${patch.patch_type.padEnd(20)} ${patch.status}`.padEnd(64) + '│');
    }
    if (summary.proposedPatches.length > 5) {
      console.log(`│   ... and ${summary.proposedPatches.length - 5} more                                       │`);
    }
  }
  
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  
  // Symmetry score
  console.log('│ SYMMETRY SCORE                                                      │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│   Overall Score: ${symmetry.overallScore.toFixed(2).padEnd(45)}│`);
  console.log(`│   Technical:     ${symmetry.technical.failureRecurrenceRate.toFixed(2).padEnd(21)}failure rate│`);
  console.log(`│   Strategic:     ${symmetry.strategic.skillCoverageRatio.toFixed(2).padEnd(21)}skill coverage│`);
  console.log(`│   Economic:     ${symmetry.economic.fairnessIndex.toFixed(2).padEnd(21)}fairness index│`);
  
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');
}

// ─── JSON Output ────────────────────────────────────────────────────────────────

function printJsonSummary(
  tenantId: string,
  summary: ReturnType<typeof getLearningSummary>,
  symmetry: ReturnType<typeof calculateSymmetry>
): void {
  const output = {
    tenant_id: tenantId,
    signal_counts: summary.signalCounts,
    diagnosis_count: summary.diagnosisCount,
    patch_count: summary.patchCount,
    proposed_patches: summary.proposedPatches.map(p => ({
      id: p.id,
      type: p.patch_type,
      status: p.status,
      target_files: p.target_files,
      created_at: p.created_at,
    })),
    applied_patches: summary.appliedPatches.length,
    rejected_patches: summary.rejectedPatches.length,
    symmetry: {
      overall_score: symmetry.overallScore,
      technical: symmetry.technical,
      strategic: symmetry.strategic,
      economic: symmetry.economic,
    },
  };
  
  console.log(JSON.stringify(output, null, 2));
}

// ─── Main Command ───────────────────────────────────────────────────────────────

export async function runLearnCommand(args: string[]): Promise<number> {
  const parsed = parseLearnArgs(args);
  const since = parseWindow(parsed.window);
  
  try {
    // Run pipeline if requested
    if (parsed.runPipeline) {
      runLearningPipeline({
        tenantId: parsed.tenantId!,
        since,
        autoGeneratePatches: true,
      });
    }
    
    // Get summary
    const summary = getLearningSummary({
      tenantId: parsed.tenantId!,
      since,
    });
    
    // Get symmetry
    const symmetry = calculateSymmetry(parsed.tenantId!, since);
    
    // Output
    if (parsed.format === 'json') {
      printJsonSummary(parsed.tenantId!, summary, symmetry);
    } else {
      printTableSummary(parsed.tenantId!, summary, symmetry);
    }
    
    return 0;
  } catch (error) {
    console.error('Error running learn command:', error);
    return 1;
  }
}

// ─── CLI Definition ─────────────────────────────────────────────────────────────

export const learn = {
  name: 'learn',
  description: 'Show learning signals, diagnoses, and patch proposals',
  
  async parse(args: string[]) {
    return runLearnCommand(args);
  },
};

