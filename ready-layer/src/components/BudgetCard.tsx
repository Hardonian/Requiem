/**
 * BudgetCard - Display budget usage with progress bar
 */

import { Budget, BudgetUnit } from '@/types/engine';

interface BudgetCardProps {
  budget: Budget;
}

export function BudgetCard({ budget }: BudgetCardProps) {
  // Get budgets from the nested structure
  const budgets = budget.budgets || {};
  const unitEntries = Object.entries(budgets) as [string, BudgetUnit | undefined][];
  
  if (unitEntries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {budget.tenant_id}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">No budget units configured</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {budget.tenant_id}
        </h3>
        <span className="text-xs font-mono text-gray-500">
          {budget.budget_hash?.substring(0, 16)}...
        </span>
      </div>

      <div className="space-y-4">
        {unitEntries.map(([unitName, unit]) => {
          if (!unit) return null;
          
          const percent = unit.limit > 0 ? (unit.used / unit.limit) * 100 : 0;
          const getColorClass = () => {
            if (percent < 70) return 'bg-green-500';
            if (percent < 90) return 'bg-yellow-500';
            return 'bg-red-500';
          };

          return (
            <div key={unitName}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {unitName.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {unit.used.toLocaleString()} / {unit.limit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`${getColorClass()} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {percent.toFixed(1)}% used · {unit.remaining.toLocaleString()} remaining
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Version: {budget.version}
        </p>
      </div>
    </div>
  );
}
