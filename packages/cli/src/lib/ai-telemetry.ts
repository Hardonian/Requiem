/**
 * AI Telemetry Bridge
 * 
 * Provides CLI-accessible telemetry summary.
 * Returns mock data for now; would connect to database in production.
 */

export interface TelemetrySummary {
  totalRequests: number;
  totalCostCents: number;
  avgLatencyMs: number;
  errorRate: number;
}

/**
 * Gets telemetry summary for a tenant.
 * Returns mock data if no database is available.
 * 
 * @param _tenantId The tenant to get summary for (reserved for future use)
 */
export function getTelemetrySummary(_tenantId: string): TelemetrySummary {
  // In production, this would query the database
  // For now, return mock data
  return {
    totalRequests: 0,
    totalCostCents: 0,
    avgLatencyMs: 0,
    errorRate: 0,
  };
}

