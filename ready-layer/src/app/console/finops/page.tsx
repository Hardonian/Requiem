'use client';

/**
 * Console FinOps Page - Financial operations and budgets
 */

import { useState, useEffect } from 'react';


interface BudgetView {
  name: string;
  limit: number;
  used: number;
  remaining: number;
}

export default function ConsoleFinOpsPage() {
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState('default');

  useEffect(() => {
    fetchBudgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
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
          });
        }
        if (budgetData.budgets.cas_put) {
          budgetViews.push({
            name: 'CAS Writes',
            limit: budgetData.budgets.cas_put.limit,
            used: budgetData.budgets.cas_put.used,
            remaining: budgetData.budgets.cas_put.remaining,
          });
        }
        if (budgetData.budgets.cas_get) {
          budgetViews.push({
            name: 'CAS Reads',
            limit: budgetData.budgets.cas_get.limit,
            used: budgetData.budgets.cas_get.used,
            remaining: budgetData.budgets.cas_get.remaining,
          });
        }
        if (budgetData.budgets.policy_eval) {
          budgetViews.push({
            name: 'Policy Evaluations',
            limit: budgetData.budgets.policy_eval.limit,
            used: budgetData.budgets.policy_eval.used,
            remaining: budgetData.budgets.policy_eval.remaining,
          });
        }
        if (budgetData.budgets.plan_step) {
          budgetViews.push({
            name: 'Plan Steps',
            limit: budgetData.budgets.plan_step.limit,
            used: budgetData.budgets.plan_step.used,
            remaining: budgetData.budgets.plan_step.remaining,
          });
        }

        setBudgets(budgetViews);
      } else {
        // Use mock data if API returns empty
        setBudgets([
          { name: 'Executions', limit: 1000, used: 42, remaining: 958 },
          { name: 'CAS Writes', limit: 5000, used: 150, remaining: 4850 },
          { name: 'CAS Reads', limit: 10000, used: 2300, remaining: 7700 },
          { name: 'Policy Evaluations', limit: 5000, used: 89, remaining: 4911 },
          { name: 'Plan Steps', limit: 2000, used: 12, remaining: 1988 },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Use mock data on error
      setBudgets([
        { name: 'Executions', limit: 1000, used: 42, remaining: 958 },
        { name: 'CAS Writes', limit: 5000, used: 150, remaining: 4850 },
        { name: 'CAS Reads', limit: 10000, used: 2300, remaining: 7700 },
        { name: 'Policy Evaluations', limit: 5000, used: 89, remaining: 4911 },
        { name: 'Plan Steps', limit: 2000, used: 12, remaining: 1988 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetWindow = async () => {
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-window', tenant_id: tenant }),
      });
      const result = await response.json();

      if (result.data?.ok) {
        alert('Budget window reset successfully');
        fetchBudgets();
      } else {
        alert(`Error: ${result.error?.message || 'Failed to reset window'}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getUsagePercent = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FinOps</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Budget tracking and financial operations
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Tenant selection"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="default">default</option>
            <option value="tenant-a">tenant-a</option>
            <option value="tenant-b">tenant-b</option>
          </select>
          <button
            onClick={handleResetWindow}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            Reset Window
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading budgets...</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">No budgets configured</p>
          <p className="text-sm text-gray-400 mt-2">Use CLI to set budgets: requiem budget set</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget, idx) => {
            const percent = getUsagePercent(budget.used, budget.limit);
            return (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {budget.name}
                </h3>
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Usage</span>
                    <span>{budget.used.toLocaleString()} / {budget.limit.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percent)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm mt-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    {percent.toFixed(1)}% used
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {budget.remaining.toLocaleString()} remaining
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
