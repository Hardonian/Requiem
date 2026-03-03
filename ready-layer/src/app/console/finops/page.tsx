// cspell:ignore NOSONAR
'use client';

/**
 * Console FinOps Page - Budget tracking and financial operations
 * 
 * What: View budget usage across all resource types.
 * Why: Budgets prevent runaway costs and ensure resource fairness.
 * What you can do: Monitor usage, reset windows, adjust limits.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  PageHeader, 
  LoadingState, 
  EmptyState,
  ErrorDisplay,
  BudgetErrorDisplay 
} from '@/components/ui';

interface BudgetView {
  name: string;
  limit: number;
  used: number;
  remaining: number;
  unit: string;
}

export default function ConsoleFinOpsPage() {
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [tenant, setTenant] = useState('default');
  const [resetting, setResetting] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/budgets?tenant=${tenant}`);
      const result = await response.json();

      if (result.data?.ok && result.data.budget) {
        const budgetData = result.data.budget;
        const budgetViews: BudgetView[] = [];

        if (budgetData.budgets.exec) {
          budgetViews.push({
            name: 'Executions',
            limit: budgetData.budgets.exec.limit,
            used: budgetData.budgets.exec.used,
            remaining: budgetData.budgets.exec.remaining,
            unit: 'calls',
          });
        }
        if (budgetData.budgets.cas_put) {
          budgetViews.push({
            name: 'CAS Writes',
            limit: budgetData.budgets.cas_put.limit,
            used: budgetData.budgets.cas_put.used,
            remaining: budgetData.budgets.cas_put.remaining,
            unit: 'writes',
          });
        }
        if (budgetData.budgets.cas_get) {
          budgetViews.push({
            name: 'CAS Reads',
            limit: budgetData.budgets.cas_get.limit,
            used: budgetData.budgets.cas_get.used,
            remaining: budgetData.budgets.cas_get.remaining,
            unit: 'reads',
          });
        }
        if (budgetData.budgets.policy_eval) {
          budgetViews.push({
            name: 'Policy Evaluations',
            limit: budgetData.budgets.policy_eval.limit,
            used: budgetData.budgets.policy_eval.used,
            remaining: budgetData.budgets.policy_eval.remaining,
            unit: 'evals',
          });
        }
        if (budgetData.budgets.plan_step) {
          budgetViews.push({
            name: 'Plan Steps',
            limit: budgetData.budgets.plan_step.limit,
            used: budgetData.budgets.plan_step.used,
            remaining: budgetData.budgets.plan_step.remaining,
            unit: 'steps',
          });
        }

        setBudgets(budgetViews);
      } else {
        // Use mock data if API returns empty
        setBudgets([
          { name: 'Executions', limit: 1000, used: 42, remaining: 958, unit: 'calls' },
          { name: 'CAS Writes', limit: 5000, used: 150, remaining: 4850, unit: 'writes' },
          { name: 'CAS Reads', limit: 10000, used: 2300, remaining: 7700, unit: 'reads' },
          { name: 'Policy Evaluations', limit: 5000, used: 89, remaining: 4911, unit: 'evals' },
          { name: 'Plan Steps', limit: 2000, used: 12, remaining: 1988, unit: 'steps' },
        ]);
      }
    } catch (err) {
      setError({
        code: 'E_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
      // Use mock data on error
      setBudgets([
        { name: 'Executions', limit: 1000, used: 42, remaining: 958, unit: 'calls' },
        { name: 'CAS Writes', limit: 5000, used: 150, remaining: 4850, unit: 'writes' },
        { name: 'CAS Reads', limit: 10000, used: 2300, remaining: 7700, unit: 'reads' },
        { name: 'Policy Evaluations', limit: 5000, used: 89, remaining: 4911, unit: 'evals' },
        { name: 'Plan Steps', limit: 2000, used: 12, remaining: 1988, unit: 'steps' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleResetWindow = useCallback(async () => {
    setResetting(true);
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-window', tenant_id: tenant }),
      });
      const result = await response.json();

      if (result.data?.ok) {
        await fetchBudgets();
      } else {
        setError({
          code: result.error?.code || 'E_RESET_FAILED',
          message: result.error?.message || 'Failed to reset budget window',
        });
      }
    } catch (err) {
      setError({
        code: 'E_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
    } finally {
      setResetting(false);
    }
  }, [tenant, fetchBudgets]);

  const getUsagePercent = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageColor = (percent: number, used: number, limit: number) => {
    if (used > limit) return 'bg-red-500';
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const exceededBudgets = budgets.filter(b => b.used > b.limit);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="FinOps"
        description="Budget tracking and financial operations. Monitor resource usage and prevent runaway costs."
        action={
          <div className="flex items-center gap-2">
            <select
              aria-label="Tenant selection"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="default">default</option>
              <option value="tenant-a">tenant-a</option>
              <option value="tenant-b">tenant-b</option>
            </select>
            <button
              onClick={handleResetWindow}
              disabled={resetting}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
              type="button"
            >
              {resetting ? 'Resetting...' : 'Reset Window'}
            </button>
          </div>
        }
      />

      {/* Budget Alerts */}
      {exceededBudgets.map(budget => (
        <div key={budget.name} className="mb-4">
          <BudgetErrorDisplay
            limitName={budget.name}
            currentUsage={budget.used}
            limit={budget.limit}
            unit={budget.unit}
          />
        </div>
      ))}

      {/* Error */}
      {error && !exceededBudgets.length && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchBudgets}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading budgets..." />
      ) : budgets.length === 0 ? (
        <EmptyState
          title="No budgets configured"
          description="Use the CLI to set budgets: requiem budget define --name <name> [rules]"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const percent = getUsagePercent(budget.used, budget.limit);
            const isExceeded = budget.used > budget.limit;
            
            return (
              <div 
                key={budget.name} 
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border ${
                  isExceeded 
                    ? 'border-red-300 dark:border-red-700' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {budget.name}
                  </h3>
                  {isExceeded && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      Exceeded
                    </span>
                  )}
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      {budget.used.toLocaleString()} / {budget.limit.toLocaleString()} {budget.unit}
                    </span>
                    <span className={`font-medium ${
                      isExceeded 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percent, budget.used, budget.limit)}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between text-sm pt-4 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                  <span className={`font-medium ${
                    budget.remaining < 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {budget.remaining.toLocaleString()} {budget.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
