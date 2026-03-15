'use client';

/**
 * Console Plans Page - Plan definitions and execution
 * 
 * What: View and manage execution plans.
 * Why: Plans define structured workflows with policy enforcement.
 * What you can do: View plan details, monitor executions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  ErrorDisplay,
  RouteMaturityNote,
} from '@/components/ui';
import { getRouteMaturity, maturityNoteTone } from '@/lib/route-maturity';

interface Plan {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  lastRun?: string;
  stepCount?: number;
  description?: string;
}

export default function ConsolePlansPage() {
  const routeMaturity = getRouteMaturity('/console/plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/plans');
      const data = await response.json();
      
      if (data.ok) {
        setPlans(data.plans || []);
      } else {
        setError({
          code: data.error?.code || 'E_FETCH_FAILED',
          message: data.error?.message || 'Failed to fetch plans',
        });
      }
    } catch (err) {
      setError({
        code: 'E_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-success/10 text-success border border-success/20';
      case 'draft':
        return 'bg-warning/10 text-warning border border-warning/20';
      case 'archived':
        return 'bg-surface-elevated text-muted border border-border';
      default:
        return 'bg-accent/10 text-accent border border-accent/20';
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Plans"
        description="Plan definitions and execution workflows. Plans define structured, policy-enforced execution paths."
      />


      <RouteMaturityNote maturity={maturityNoteTone(routeMaturity.maturity)} title="Maturity: demo-backed route">
        {routeMaturity.degradedBehavior}
      </RouteMaturityNote>

      {/* Error */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchPlans}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading plans..." />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans found"
          description="No live plans were returned. In local/demo mode this can be expected; use verify:all plus engine wiring to validate end-to-end plan execution."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="truncate text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                  {plan.status || 'unknown'}
                </span>
              </div>
              
              {plan.description && (
                <p className="mb-4 line-clamp-2 text-sm text-muted">
                  {plan.description}
                </p>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Steps:</span>
                  <span className="text-foreground/85">{plan.stepCount || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Created:</span>
                  <span className="text-foreground/85">
                    {plan.createdAt?.substring(0, 10) || '-'}
                  </span>
                </div>
                {plan.lastRun && (
                  <div className="flex justify-between">
                    <span className="text-muted">Last run:</span>
                    <span className="text-foreground/85">
                      {plan.lastRun.substring(0, 10)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total count */}
      {!loading && plans.length > 0 && (
        <div className="mt-6 text-sm text-muted">
          Total: {plans.length} plan{plans.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
