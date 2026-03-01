/**
 * reach economics CLI Command
 * 
 * Show economic metrics and alerts
 * 
 * Usage:
 *   reach economics
 *   reach economics --alerts
 *   reach economics --forecast
 *   reach fairness
 */

import { getEconomicSummary, detectEconomicAlerts, createAlertsFromDetection } from '../lib/economic-layer';

// ─── Argument Parsing ───────────────────────────────────────────────────────────

export interface EconomicsArgs {
  alerts?: boolean;
  forecast?: boolean;
  fairness?: boolean;
  tenantId?: string;
}

// ─── Main Command ───────────────────────────────────────────────────────────────

export async function runEconomicsCommand(args: string[]): Promise<number> {
  const parsed: EconomicsArgs = {
    alerts: args.includes('--alerts'),
    forecast: args.includes('--forecast'),
    fairness: args.includes('--fairness'),
  };
  
  const tenantId = process.env.REQUIEM_TENANT_ID || 'default-tenant';
  
  try {
    // Detect alerts first
    const detectedAlerts = detectEconomicAlerts(tenantId);
    
    // Create alerts in database
    if (detectedAlerts.length > 0) {
      createAlertsFromDetection(tenantId, detectedAlerts);
    }
    
    // Get full summary
    const summary = getEconomicSummary(tenantId);
    
    if (parsed.alerts) {
      // Show only alerts
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────────────┐');
      console.log('│ ECONOMIC ALERTS                                                     │');
      console.log(`│ Tenant: ${tenantId.padEnd(55)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      
      if (summary.alerts.length === 0 && detectedAlerts.length === 0) {
        console.log('│   No alerts detected                                                │');
      } else {
        for (const alert of summary.alerts) {
          console.log(`│   ${alert.alert_type.padEnd(20)} [${alert.severity.padEnd(8)}] ${alert.created_at.substring(0, 20)}│`);
        }
        for (const alert of detectedAlerts) {
          console.log(`│   ${alert.alertType.padEnd(20)} [${alert.severity.padEnd(8)}] (new)`.padEnd(64) + '│');
        }
      }
      
      console.log('└─────────────────────────────────────────────────────────────────────┘');
      console.log('');
      
      return 0;
    }
    
    if (parsed.forecast) {
      // Show only forecast
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────────────┐');
      console.log('│ ECONOMIC FORECAST                                                   │');
      console.log(`│ Tenant: ${tenantId.padEnd(55)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│   Trend: ${summary.forecast.trend.padEnd(57)}│`);
      console.log(`│   Projected Burn Rate: ${summary.forecast.projectedBurnRate.toFixed(2).padEnd(37)}│`);
      console.log(`│   Projected Storage:   ${summary.forecast.projectedStorageUsage.toFixed(2).padEnd(37)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log('│ RECOMMENDATION                                                      │');
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│ ${summary.forecast.recommendation.padEnd(62)}│`);
      console.log('└─────────────────────────────────────────────────────────────────────┘');
      console.log('');
      
      return 0;
    }
    
    if (parsed.fairness) {
      // Show only fairness
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────────────┐');
      console.log('│ FAIRNESS METRICS                                                    │');
      console.log(`│ Tenant: ${tenantId.padEnd(55)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log(`│   Fairness Index:     ${summary.fairness.fairnessIndex.toFixed(4).padEnd(37)}│`);
      console.log(`│   Tenant Imbalance:   ${summary.fairness.tenantImbalance.toFixed(4).padEnd(37)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      
      if (summary.fairness.violations.length > 0) {
        console.log('│ VIOLATIONS                                                          │');
        console.log('├─────────────────────────────────────────────────────────────────────┤');
        for (const v of summary.fairness.violations) {
          console.log(`│   ${v.padEnd(62)}│`);
        }
      } else {
        console.log('│   No violations detected                                           │');
      }
      
      console.log('└─────────────────────────────────────────────────────────────────────┘');
      console.log('');
      
      return 0;
    }
    
    // Default: show full economic summary
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│ ECONOMIC SUMMARY                                                    │');
    console.log(`│ Tenant: ${tenantId.padEnd(55)}│`);
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│ TOTALS                                                              │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   Total Cost:        ${summary.totalCost.toFixed(0).padEnd(37)}│`);
    console.log(`│   Total Runs:        ${summary.totalRuns.toString().padEnd(37)}│`);
    console.log(`│   Avg Cost/Run:      ${summary.avgCostPerRun.toFixed(4).padEnd(37)}│`);
    console.log(`│   Active Alerts:    ${summary.alerts.length.toString().padEnd(37)}│`);
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│ FORECAST                                                            │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   Trend: ${summary.forecast.trend.padEnd(57)}│`);
    console.log(`│   ${summary.forecast.recommendation.substring(0, 60).padEnd(60)}│`);
    if (summary.forecast.recommendation.length > 60) {
      console.log(`│   ${summary.forecast.recommendation.substring(60).padEnd(60)}│`);
    }
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│ FAIRNESS                                                            │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   Fairness Index:   ${summary.fairness.fairnessIndex.toFixed(4).padEnd(37)}│`);
    console.log(`│   Imbalance:        ${summary.fairness.tenantImbalance.toFixed(4).padEnd(37)}│`);
    
    if (detectedAlerts.length > 0) {
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      console.log('│ NEW ALERTS                                                          │');
      console.log('├─────────────────────────────────────────────────────────────────────┤');
      for (const alert of detectedAlerts) {
        console.log(`│   ${alert.alertType.padEnd(20)} [${alert.severity.padEnd(8)}] ${alert.currentValue.toFixed(2)} > ${alert.threshold.toFixed(2)}│`);
      }
    }
    
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    return 0;
  } catch (error) {
    console.error('Error running economics command:', error);
    return 1;
  }
}

// ─── CLI Definition ─────────────────────────────────────────────────────────────

export const economics = {
  name: 'economics',
  description: 'Show economic metrics and alerts',
  
  async parse(args: string[]) {
    return runEconomicsCommand(args);
  },
};
