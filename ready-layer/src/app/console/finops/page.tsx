'use client';

/**
 * Console FinOps Page - Budget tracking and financial operations
 *
 * What: View budget usage across all resource types.
 * Why: Budgets prevent runaway costs and ensure resource fairness.
 * What you can do: Monitor usage, reset windows, adjust limits.
 *
 * API: GET /api/budgets?tenant=X → { data:{ ok:true, budget:{budgets:{exec,cas_put,...}} } }
 * API: POST /api/budgets { action:'reset-window', tenant_id } → { data:{ ok:true } }
 */

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, LoadingState, EmptyState, ErrorDisplay, BudgetErrorDisplay } from '@/components/ui';

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
      const response = await fetch(`/api/budgets?tenant=${encodeURIComponent(tenant)}`);
      const result = await response.json();

      if (result.data?.ok && result.data.budget) {
        const budgetData = result.data.budget;
        const budgetViews: BudgetView[] = [];

        if (budgetData.budgets?.exec) {
          budgetViews.push({
            name: 'Executions',
            limit: budgetData.budgets.exec.limit,
            used: budgetData.budgets.exec.used,
            remaining: budgetData.budgets.exec.remaining,
            unit: 'calls',
          });
        }
        if (budgetData.budgets?.cas_put) {
          budgetViews.push({
            name: 'CAS Writes',
            limit: budgetData.budgets.cas_put.limit,
            used: budgetData.budgets.cas_put.used,
            remaining: budgetData.budgets.cas_put.remaining,
            unit: 'writes',
          });
        }
        if (budgetData.budgets?.cas_get) {
          budgetViews.push({
            name: 'CAS Reads',
            limit: budgetData.budgets.cas_get.limit,
            used: budgetData.budgets.cas_get.used,
            remaining: budgetData.budgets.cas_get.remaining,
            unit: 'reads',
          });
        }
        if (budgetData.budgets?.policy_eval) {
          budgetViews.push({
            name: 'Policy Evaluations',
            limit: budgetData.budgets.policy_eval.limit,
            used: budgetData.budgets.policy_eval.used,
            remaining: budgetData.budgets.policy_eval.remaining,
            unit: 'evals',
          });
        }
        if (budgetData.budgets?.plan_step) {
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
        // No budgets configured for this tenant — show empty state, not mock data
        setBudgets([]);
      }
    } catch (err) {
      setError({
        code: 'E_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
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
          code: result.error?.code ?? 'E_RESET_FAILED',
          message: result.error?.message ?? 'Failed to reset budget window',
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

  const getUsageBarClass = (percent: number, used: number, limit: number) => {
    if (used > limit) return 'bg-destructive';
    if (percent >= 90) return 'bg-destructive';
    if (percent >= 70) return 'bg-warning';
    return 'bg-success';
  };

  const exceededBudgets = budgets.filter((b) => b.used > b.limit);

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
              className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="default">default</option>
              <option value="tenant-a">tenant-a</option>
              <option value="tenant-b">tenant-b</option>
            </select>
            <button
              onClick={handleResetWindow}
              disabled={resetting}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:brightness-110 disabled:opacity-50 transition-all text-sm font-medium"
              type="button"
            >
              {resetting ? 'Resetting...' : 'Reset Window'}
            </button>
          </div>
        }
      />

      {/* Budget Alerts */}
      {exceededBudgets.map((budget) => (
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
                className={`bg-surface rounded-xl border p-6 shadow-sm ${
                  isExceeded ? 'border-destructive/50' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">{budget.name}</h3>
                  {isExceeded && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                      Exceeded
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">
                      {budget.used.toLocaleString()} / {budget.limit.toLocaleString()} {budget.unit}
                    </span>
                    <span className={`font-medium ${isExceeded ? 'text-destructive' : 'text-foreground'}`}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2 border border-border">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageBarClass(
                        percent,
                        budget.used,
                        budget.limit,
                      )}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm pt-4 border-t border-border">
                  <span className="text-muted">Remaining</span>
                  <span
                    className={`font-medium ${budget.remaining < 0 ? 'text-destructive' : 'text-success'}`}
                  >
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
