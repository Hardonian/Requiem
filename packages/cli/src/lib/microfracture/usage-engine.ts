/**
 * Usage Engine — Tenant-scoped usage rollups and reporting
 *
 * INVARIANT: All aggregations are deterministic
 * INVARIANT: No floating point precision issues (use integers)
 * INVARIANT: Stable ordering for consistent output
 */

export interface UsageRecord {
  runId: string;
  tenantId: string;
  toolName: string;
  costCents: number;
  latencyMs: number;
  storageBytes: number;
  policyEvalCount: number;
  timestamp: string;
}

export interface UsageRollup {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  runsCount: number;
  totalCostCents: number;
  totalLatencyMs: number;
  replayStorageBytes: number;
  policyEvalsCount: number;
  avgCostPerRunCents: number;
  avgLatencyPerRunMs: number;
}

export interface UsageSummary {
  tenantId: string;
  totalRuns: number;
  totalCostUsd: number;
  totalStorageBytes: number;
  periodCovered: { start: string; end: string };
  dailyAverage: {
    runs: number;
    costUsd: number;
  };
  topTools: Array<{ toolName: string; runs: number; costCents: number }>;
}

/**
 * Aggregate usage records into rollup
 */
export function aggregateUsage(
  records: UsageRecord[],
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): UsageRollup {
  // Filter records for this tenant and period
  const filtered = records.filter(r =>
    r.tenantId === tenantId &&
    new Date(r.timestamp) >= periodStart &&
    new Date(r.timestamp) < periodEnd
  );

  // Aggregate (all integer operations for determinism)
  const runsCount = filtered.length;
  const totalCostCents = filtered.reduce((sum, r) => sum + r.costCents, 0);
  const totalLatencyMs = filtered.reduce((sum, r) => sum + r.latencyMs, 0);
  const replayStorageBytes = filtered.reduce((sum, r) => sum + r.storageBytes, 0);
  const policyEvalsCount = filtered.reduce((sum, r) => sum + r.policyEvalCount, 0);

  // Calculate averages (integer division)
  const avgCostPerRunCents = runsCount > 0 ? Math.floor(totalCostCents / runsCount) : 0;
  const avgLatencyPerRunMs = runsCount > 0 ? Math.floor(totalLatencyMs / runsCount) : 0;

  return {
    tenantId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    runsCount,
    totalCostCents,
    totalLatencyMs,
    replayStorageBytes,
    policyEvalsCount,
    avgCostPerRunCents,
    avgLatencyPerRunMs,
  };
}

/**
 * Generate usage summary with top tools
 */
export function generateUsageSummary(
  records: UsageRecord[],
  tenantId: string
): UsageSummary {
  // Filter for tenant
  const filtered = records.filter(r => r.tenantId === tenantId);

  // Get period covered
  const timestamps = filtered.map(r => new Date(r.timestamp).getTime());
  const minTime = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

  // Aggregate totals
  const totalRuns = filtered.length;
  const totalCostCents = filtered.reduce((sum, r) => sum + r.costCents, 0);
  const totalStorageBytes = filtered.reduce((sum, r) => sum + r.storageBytes, 0);

  // Calculate daily average
  const days = Math.max(1, Math.ceil((maxTime - minTime) / (24 * 60 * 60 * 1000)));
  const dailyAvgRuns = totalRuns / days;
  const dailyAvgCostCents = totalCostCents / days;

  // Aggregate by tool
  const toolStats = new Map<string, { runs: number; costCents: number }>();
  for (const r of filtered) {
    const current = toolStats.get(r.toolName) || { runs: 0, costCents: 0 };
    current.runs++;
    current.costCents += r.costCents;
    toolStats.set(r.toolName, current);
  }

  // Get top tools (sorted by cost, stable)
  const topTools = Array.from(toolStats.entries())
    .map(([toolName, stats]) => ({ toolName, ...stats }))
    .sort((a, b) => b.costCents - a.costCents || a.toolName.localeCompare(b.toolName))
    .slice(0, 5);

  return {
    tenantId,
    totalRuns,
    totalCostUsd: totalCostCents / 100,
    totalStorageBytes,
    periodCovered: {
      start: new Date(minTime).toISOString(),
      end: new Date(maxTime).toISOString(),
    },
    dailyAverage: {
      runs: Math.round(dailyAvgRuns * 100) / 100,
      costUsd: Math.round((dailyAvgCostCents / 100) * 100) / 100,
    },
    topTools,
  };
}

/**
 * Format usage as table for CLI
 */
export function formatUsageAsTable(summary: UsageSummary): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ USAGE SUMMARY                                              │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Tenant:  ${summary.tenantId.substring(0, 46).padEnd(46)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Total Runs:    ${summary.totalRuns.toString().padEnd(38)}│`,
    `│  Total Cost:    $${summary.totalCostUsd.toFixed(2).padEnd(37)}│`,
    `│  Storage:       ${formatBytes(summary.totalStorageBytes).padEnd(38)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  DAILY AVERAGE                                             │',
    `│    Runs:        ${summary.dailyAverage.runs.toFixed(2).padEnd(38)}│`,
    `│    Cost:        $${summary.dailyAverage.costUsd.toFixed(2).padEnd(37)}│`,
  ];

  if (summary.topTools.length > 0) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  TOP TOOLS                                                 │');
    for (const tool of summary.topTools) {
      const cost = `$${(tool.costCents / 100).toFixed(2)}`;
      lines.push(`│  ${tool.toolName.substring(0, 20).padEnd(20)} ${tool.runs.toString().padStart(6)} runs  ${cost.padStart(8)}  │`);
    }
  }

  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * Format usage as JSON
 */
export function formatUsageAsJson(summary: UsageSummary): Record<string, unknown> {
  return {
    tenantId: summary.tenantId,
    period: summary.periodCovered,
    totals: {
      runs: summary.totalRuns,
      costUsd: summary.totalCostUsd,
      storageBytes: summary.totalStorageBytes,
    },
    dailyAverage: summary.dailyAverage,
    topTools: summary.topTools.map(t => ({
      name: t.toolName,
      runs: t.runs,
      costUsd: t.costCents / 100,
    })),
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
