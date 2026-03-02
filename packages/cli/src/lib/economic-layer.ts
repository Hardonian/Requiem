/**
 * Economic Symmetry Layer
 * 
 * Tracks:
 * - Cost model configuration
 * - Economic events
 * - Economic alerts
 * - Economic rollups
 * 
 * All metrics are pure functions of stored metadata.
 */

import {
  EconomicEventRepository,
  EconomicRollupRepository,
  EconomicAlertRepository,
  type EventType,
  type AlertType,
  type AlertSeverity,
  type EconomicEvent,
  type EconomicRollup,
  type EconomicAlert,
} from '../db/governance.js';

// ─── Cost Model Configuration ─────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

interface CostModelConfig {
  version: string;
  cost_units: {
    execution_unit: number;
    replay_storage_unit: number;
    policy_eval_unit: number;
    drift_analysis_unit: number;
  };
  thresholds: {
    burn_spike_multiplier: number;
    storage_spike_multiplier: number;
    policy_spike_multiplier: number;
    fairness_violation_threshold: number;
    confidence_threshold_low: number;
    confidence_threshold_medium: number;
    confidence_threshold_high: number;
  };
}

let costModelConfig: CostModelConfig | null = null;

function getCostModel(): CostModelConfig {
  if (!costModelConfig) {
    try {
      const configPath = path.join(process.cwd(), 'contracts/cost-model.json');
      const configData = fs.readFileSync(configPath, 'utf-8');
      costModelConfig = JSON.parse(configData);
    } catch {
      // Default config if file not found
      costModelConfig = {
        version: '1.0.0',
        cost_units: {
          execution_unit: 1,
          replay_storage_unit: 1,
          policy_eval_unit: 1,
          drift_analysis_unit: 1,
        },
        thresholds: {
          burn_spike_multiplier: 2.0,
          storage_spike_multiplier: 2.0,
          policy_spike_multiplier: 2.0,
          fairness_violation_threshold: 0.2,
          confidence_threshold_low: 30,
          confidence_threshold_medium: 60,
          confidence_threshold_high: 90,
        },
      };
    }
  }
  return costModelConfig!;
}

// ─── Event Recording ───────────────────────────────────────────────────────────

export interface RecordEventParams {
  tenantId: string;
  runId?: string;
  eventType: EventType;
  resourceUnits: number;
  costUnits?: number;
}

/**
 * Record an economic event.
 */
export function recordEconomicEvent(params: RecordEventParams): EconomicEvent {
  const costModel = getCostModel();
  const costUnits = params.costUnits ?? (
    params.resourceUnits * costModel.cost_units[
      params.eventType === 'execution' ? 'execution_unit' :
      params.eventType === 'replay_storage' ? 'replay_storage_unit' :
      params.eventType === 'policy_eval' ? 'policy_eval_unit' :
      'drift_analysis_unit'
    ]
  );
  
  return EconomicEventRepository.create({
    tenantId: params.tenantId,
    runId: params.runId,
    eventType: params.eventType,
    resourceUnits: params.resourceUnits,
    costUnits,
  });
}

// ─── Alert Detection ───────────────────────────────────────────────────────────

export interface AlertDetectionResult {
  alertType: AlertType;
  severity: AlertSeverity;
  currentValue: number;
  threshold: number;
  metadata: Record<string, unknown>;
}

/**
 * Detect economic anomalies based on thresholds.
 */
export function detectEconomicAlerts(
  tenantId: string,
  since?: Date
): AlertDetectionResult[] {
  const costModel = getCostModel();
  const events = EconomicEventRepository.findByTenant(tenantId, since);
  
  // Calculate totals by type
  const totals: Partial<Record<EventType, { resources: number; costs: number }>> = {};
  for (const event of events) {
    if (!totals[event.event_type]) {
      totals[event.event_type] = { resources: 0, costs: 0 };
    }
    totals[event.event_type]!.resources += event.resource_units;
    totals[event.event_type]!.costs += event.cost_units;
  }
  
  const alerts: AlertDetectionResult[] = [];
  
  // Check for burn spike
  const executionCosts = totals.execution?.costs || 0;
  const avgCost = executionCosts / Math.max(events.filter(e => e.event_type === 'execution').length, 1);
  if (executionCosts > avgCost * costModel.thresholds.burn_spike_multiplier) {
    alerts.push({
      alertType: 'burn_spike',
      severity: executionCosts > avgCost * 3 ? 'critical' : 'high',
      currentValue: executionCosts,
      threshold: avgCost * costModel.thresholds.burn_spike_multiplier,
      metadata: { avg_cost: avgCost, multiplier: costModel.thresholds.burn_spike_multiplier },
    });
  }
  
  // Check for storage spike
  const storageCosts = totals.replay_storage?.costs || 0;
  const avgStorage = storageCosts / Math.max(events.filter(e => e.event_type === 'replay_storage').length, 1);
  if (storageCosts > avgStorage * costModel.thresholds.storage_spike_multiplier && avgStorage > 0) {
    alerts.push({
      alertType: 'storage_spike',
      severity: storageCosts > avgStorage * 3 ? 'critical' : 'high',
      currentValue: storageCosts,
      threshold: avgStorage * costModel.thresholds.storage_spike_multiplier,
      metadata: { avg_storage: avgStorage },
    });
  }
  
  // Check for policy spike
  const policyCosts = totals.policy_eval?.costs || 0;
  const avgPolicy = policyCosts / Math.max(events.filter(e => e.event_type === 'policy_eval').length, 1);
  if (policyCosts > avgPolicy * costModel.thresholds.policy_spike_multiplier && avgPolicy > 0) {
    alerts.push({
      alertType: 'policy_spike',
      severity: policyCosts > avgPolicy * 3 ? 'critical' : 'high',
      currentValue: policyCosts,
      threshold: avgPolicy * costModel.thresholds.policy_spike_multiplier,
      metadata: { avg_policy: avgPolicy },
    });
  }
  
  return alerts;
}

// ─── Create Alerts ─────────────────────────────────────────────────────────────

export function createAlertsFromDetection(
  tenantId: string,
  alerts: AlertDetectionResult[]
): EconomicAlert[] {
  const createdAlerts: EconomicAlert[] = [];
  
  for (const alert of alerts) {
    const created = EconomicAlertRepository.create({
      tenantId,
      alertType: alert.alertType,
      severity: alert.severity,
      metadata: alert.metadata,
    });
    createdAlerts.push(created);
  }
  
  return createdAlerts;
}

// ─── Economic Rollup ──────────────────────────────────────────────────────────

export interface RollupParams {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Generate an economic rollup for a period.
 */
export function generateEconomicRollup(params: RollupParams): EconomicRollup | null {
  const events = EconomicEventRepository.findByTenant(params.tenantId, params.periodStart);
  
  let totalRuns = 0;
  let totalCost = 0;
  let totalStorage = 0;
  let totalPolicy = 0;
  
  for (const event of events) {
    if (event.event_type === 'execution') {
      totalRuns++;
      totalCost += event.cost_units;
    } else if (event.event_type === 'replay_storage') {
      totalStorage += event.cost_units;
    } else if (event.event_type === 'policy_eval') {
      totalPolicy += event.cost_units;
    } else if (event.event_type === 'drift_analysis') {
      totalCost += event.cost_units;
    }
  }
  
  return EconomicRollupRepository.create({
    tenantId: params.tenantId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    totalRuns,
    totalCostUnits: totalCost,
    totalStorageUnits: totalStorage,
    totalPolicyUnits: totalPolicy,
  });
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export interface EconomicForecast {
  projectedBurnRate: number;
  projectedStorageUsage: number;
  trend: 'stable' | 'increasing' | 'decreasing';
  recommendation: string;
}

/**
 * Forecast economic metrics based on historical data.
 */
export function forecastEconomics(tenantId: string): EconomicForecast {
  const rollups = EconomicRollupRepository.findByTenant(tenantId);
  
  if (rollups.length < 2) {
    return {
      projectedBurnRate: 0,
      projectedStorageUsage: 0,
      trend: 'stable',
      recommendation: 'Insufficient data for forecasting. Continue monitoring.',
    };
  }
  
  // Calculate trend from recent rollups
  const recent = rollups.slice(0, Math.min(7, rollups.length));
  const costs = recent.map(r => r.total_cost_units);
  
  let trend: 'stable' | 'increasing' | 'decreasing' = 'stable';
  if (costs.length >= 2) {
    const first = costs[0];
    const last = costs[costs.length - 1];
    const change = (last - first) / Math.max(first, 1);
    
    if (change > 0.2) {
      trend = 'increasing';
    } else if (change < -0.2) {
      trend = 'decreasing';
    }
  }
  
  // Project future burn rate (simple average)
  const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
  const projectedBurnRate = avgCost;
  
  // Project storage (sum of storage units)
  const projectedStorageUsage = recent.reduce((a, r) => a + r.total_storage_units, 0);
  
  // Generate recommendation
  let recommendation = '';
  if (trend === 'increasing') {
    recommendation = 'Cost trend is increasing. Consider reviewing resource allocation or implementing cost controls.';
  } else if (trend === 'decreasing') {
    recommendation = 'Cost trend is decreasing. Current optimization strategies are effective.';
  } else {
    recommendation = 'Costs are stable. Continue monitoring for anomalies.';
  }
  
  return {
    projectedBurnRate,
    projectedStorageUsage,
    trend,
    recommendation,
  };
}

// ─── Fairness Calculation ─────────────────────────────────────────────────────

export interface FairnessMetrics {
  fairnessIndex: number;
  tenantImbalance: number;
  violations: string[];
}

/**
 * Calculate fairness metrics across tenants.
 */
export function calculateFairness(tenantId: string): FairnessMetrics {
  const events = EconomicEventRepository.findByTenant(tenantId);
  
  // Simplified fairness calculation
  // In production, this would compare across tenants
  
  const totalCost = events.reduce((sum, e) => sum + e.cost_units, 0);
  const avgCost = events.length > 0 ? totalCost / events.length : 0;
  
  // Check for significant cost variance within tenant
  const costVariance = events.reduce((sum, e) => 
    sum + Math.pow(e.cost_units - avgCost, 2), 0
  ) / Math.max(events.length, 1);
  
  const stdDev = Math.sqrt(costVariance);
  const imbalance = avgCost > 0 ? stdDev / avgCost : 0;
  
  const costModel = getCostModel();
  const threshold = costModel.thresholds.fairness_violation_threshold;
  
  const violations: string[] = [];
  if (imbalance > threshold) {
    violations.push(`Tenant imbalance (${imbalance.toFixed(2)}) exceeds threshold (${threshold})`);
  }
  
  return {
    fairnessIndex: Math.max(0, 1 - imbalance),
    tenantImbalance: imbalance,
    violations,
  };
}

// ─── Economic Summary ─────────────────────────────────────────────────────────

export interface EconomicSummary {
  totalCost: number;
  totalRuns: number;
  avgCostPerRun: number;
  alerts: EconomicAlert[];
  forecast: EconomicForecast;
  fairness: FairnessMetrics;
}

/**
 * Get a complete economic summary.
 */
export function getEconomicSummary(tenantId: string): EconomicSummary {
  const events = EconomicEventRepository.findByTenant(tenantId);
  const alerts = EconomicAlertRepository.findByTenant(tenantId);
  const forecast = forecastEconomics(tenantId);
  const fairness = calculateFairness(tenantId);
  
  const totalCost = events.reduce((sum, e) => sum + e.cost_units, 0);
  const executionEvents = events.filter(e => e.event_type === 'execution');
  const totalRuns = executionEvents.length;
  const avgCostPerRun = totalRuns > 0 ? totalCost / totalRuns : 0;
  
  return {
    totalCost,
    totalRuns,
    avgCostPerRun,
    alerts,
    forecast,
    fairness,
  };
}

