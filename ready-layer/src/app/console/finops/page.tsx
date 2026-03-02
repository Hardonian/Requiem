'use client';

/**
 * Console FinOps Page - Financial operations and budgets
 */

import { useState, useEffect } from 'react';

interface Budget {
  name: string;
  limit: number;
  used: number;
  windowStart: string;
  windowEnd: string;
}

export default function ConsoleFinOpsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/budgets');
      const data = await response.json();
      
      if (data.ok) {
        setBudgets(data.budgets || []);
      } else {
        setError(data.error?.message || 'Failed to fetch budgets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
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
                      className={`h-2 rounded-full ${getUsageColor(percent)}`} 
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  <p>Window: {budget.windowStart?.substring(0, 10) || '-'} to {budget.windowEnd?.substring(0, 10) || '-'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
