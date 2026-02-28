/**
 * AI Telemetry Dashboard Component
 * 
 * Displays AI usage metrics including cost, requests, latency, and error rates.
 * Enterprise-gated component.
 */

import { Card } from '../primitives/card';
import { MetricCard } from '../data/metric-card';

export interface TelemetrySummary {
  totalRequests: number;
  totalCostCents: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface AiTelemetryDashboardProps {
  summary: TelemetrySummary;
  tenantId?: string;
  period?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * AI Telemetry Dashboard Component
 * Displays key AI usage metrics
 */
export function AiTelemetryDashboard({ 
  summary, 
  tenantId, 
  period = 'day' 
}: AiTelemetryDashboardProps) {
  const formatCost = (cents: number) => {
    if (cents >= 100) {
      return `$${(cents / 100).toFixed(2)}`;
    }
    return `${cents}c`;
  };

  const formatLatency = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  return (
    <div className="space-y-4">
      {tenantId && (
        <div className="text-sm text-gray-500 mb-2">
          Tenant: <span className="font-mono">{tenantId}</span>
          <span className="mx-2">|</span>
          Period: <span className="capitalize">{period}</span>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Requests"
          value={summary.totalRequests}
          format="number"
        />
        <MetricCard
          label="Total Cost"
          value={formatCost(summary.totalCostCents)}
        />
        <MetricCard
          label="Avg Latency"
          value={formatLatency(summary.avgLatencyMs)}
        />
        <MetricCard
          label="Error Rate"
          value={summary.errorRate}
          format="percentage"
        />
      </div>

      {summary.totalRequests === 0 && (
        <Card className="p-4">
          <div className="text-gray-500 text-center py-2">
            No AI activity recorded for this period
          </div>
        </Card>
      )}
    </div>
  );
}
