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
  RouteMaturityNote 
} from '@/components/ui';

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
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Plans"
        description="Plan definitions and execution workflows. Plans define structured, policy-enforced execution paths."
      />


      <RouteMaturityNote maturity="demo" title="Maturity: demo-backed route">
        This page reads from <code className="font-mono">/api/plans</code> demo responses in this repo. It is useful for UI and response-shape validation, but it does not prove a live plan engine is attached.
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
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {plan.name}
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                  {plan.status || 'unknown'}
                </span>
              </div>
              
              {plan.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {plan.description}
                </p>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Steps:</span>
                  <span className="text-gray-700 dark:text-gray-300">{plan.stepCount || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {plan.createdAt?.substring(0, 10) || '-'}
                  </span>
                </div>
                {plan.lastRun && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Last run:</span>
                    <span className="text-gray-700 dark:text-gray-300">
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
        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Total: {plans.length} plan{plans.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
