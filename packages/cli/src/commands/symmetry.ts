/**
 * reach symmetry CLI Command
 * 
 * Show symmetry metrics
 * 
 * Usage:
 *   reach symmetry
 *   reach symmetry --economics
 */

import { calculateSymmetry } from '../lib/symmetry-engine.js';
import { getEconomicSummary } from '../lib/economic-layer.js';

// ─── Argument Parsing ───────────────────────────────────────────────────────────

export interface SymmetryArgs {
  economics?: boolean;
  tenantId?: string;
}

// ─── Main Command ───────────────────────────────────────────────────────────────

export async function runSymmetryCommand(args: string[]): Promise<number> {
  const parsed: SymmetryArgs = {
    economics: args.includes('--economics'),
  };
  
  const tenantId = process.env.REQUIEM_TENANT_ID || 'default-tenant';
  
  try {
    const symmetry = calculateSymmetry(tenantId);
    
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│ SYMMETRY METRICS                                                    │');
    console.log(`│ Tenant: ${tenantId.padEnd(55)}│`);
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│ OVERALL SCORE                                                       │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   ${symmetry.overallScore.toFixed(2)} / 100`.padEnd(64) + '│');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│ TECHNICAL SYMMETRY                                                  │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   Failure Recurrence Rate:  ${symmetry.technical.failureRecurrenceRate.toFixed(4).padEnd(25)}│`);
    console.log(`│   Drift Severity Score:    ${symmetry.technical.driftSeverityScore.toFixed(4).padEnd(25)}│`);
    console.log(`│   Replay Mismatch Rate:    ${symmetry.technical.replayMismatchRate.toFixed(4).padEnd(25)}│`);
    console.log(`│   Time to Green (avg):     ${symmetry.technical.timeToGreen.toFixed(4).padEnd(25)}│`);
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│ STRATEGIC SYMMETRY                                                 │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   Rollback Frequency:     ${symmetry.strategic.rollbackFrequency.toFixed(4).padEnd(25)}│`);
    console.log(`│   Skill Coverage Ratio:   ${symmetry.strategic.skillCoverageRatio.toFixed(4).padEnd(25)}│`);
    console.log(`│   Instruction Coverage:   ${symmetry.strategic.instructionCoverageScore.toFixed(4).padEnd(25)}│`);
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    
    if (parsed.economics || args.includes('--economics')) {
      console.log('│ ECONOMIC SYMMETRY                                                  │');
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│   Burn Rate:              ${symmetry.economic.burnRate.toFixed(4).padEnd(25)}│`);
      console.log(`│   Cost per Verified Run: ${symmetry.economic.costPerVerifiedRun.toFixed(4).padEnd(25)}│`);
      console.log(`│   Replay Efficiency:      ${symmetry.economic.replayEfficiencyRatio.toFixed(4).padEnd(25)}│`);
      console.log(`│   Fairness Index:         ${symmetry.economic.fairnessIndex.toFixed(4).padEnd(25)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      
      // Also show economic summary
      const economicSummary = getEconomicSummary(tenantId);
      
      console.log('│ ECONOMIC SUMMARY                                                    │');
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│   Total Cost:             ${economicSummary.totalCost.toFixed(0).padEnd(25)}│`);
      console.log(`│   Total Runs:             ${economicSummary.totalRuns.toString().padEnd(25)}│`);
      console.log(`│   Avg Cost/Run:           ${economicSummary.avgCostPerRun.toFixed(4).padEnd(25)}│`);
      console.log(`│   Active Alerts:          ${economicSummary.alerts.length.toString().padEnd(25)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log('│ FORECAST                                                               │');
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│   Trend: ${economicSummary.forecast.trend.padEnd(58)}│`);
      console.log(`│   ${economicSummary.forecast.recommendation.substring(0, 60).padEnd(60)}│`);
      if (economicSummary.forecast.recommendation.length > 60) {
        console.log(`│   ${economicSummary.forecast.recommendation.substring(60).padEnd(60)}│`);
      }
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log('│ FAIRNESS                                                             │');
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│   Fairness Index:       ${economicSummary.fairness.fairnessIndex.toFixed(4).padEnd(25)}│`);
      console.log(`│   Tenant Imbalance:     ${economicSummary.fairness.tenantImbalance.toFixed(4).padEnd(25)}│`);
      if (economicSummary.fairness.violations.length > 0) {
        console.log('│   Violations:');
        for (const v of economicSummary.fairness.violations) {
          console.log(`│     - ${v.padEnd(57)}│`);
        }
      }
    }
    
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    return 0;
  } catch (error) {
    console.error('Error calculating symmetry:', error);
    return 1;
  }
}

// ─── CLI Definition ─────────────────────────────────────────────────────────────

export const symmetry = {
  name: 'symmetry',
  description: 'Show symmetry metrics',
  
  async parse(args: string[]) {
    return runSymmetryCommand(args);
  },
};

