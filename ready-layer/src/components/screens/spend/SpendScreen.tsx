'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorDisplay, LoadingState, PageHeader } from '@/components/ui';

type Budget = { limit: number; used: number; remaining: number };

export function SpendScreen() {
  const [budgets, setBudgets] = useState<Record<string, Budget> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/budgets?tenant=default');
        const body = await res.json();
        if (!res.ok || body.error) {
          setError({ code: body?.error?.code ?? 'budget_error', message: body?.error?.message ?? 'Failed to load spend data' });
          return;
        }
        setBudgets(body?.data?.budget?.budgets ?? null);
      } catch (e) {
        setError({ code: 'network_error', message: e instanceof Error ? e.message : 'Failed to load spend data' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader title="Spend" description="Track budget usage and policy pressure across execution units." />
      {loading ? <LoadingState message="Loading spend metrics..." /> : null}
      {error ? <ErrorDisplay code={error.code} message={error.message} /> : null}
      {!loading && !error && !budgets ? <EmptyState title="No spend data" description="Budget tracking is not configured yet." /> : null}
      {!loading && !error && budgets ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(budgets).map(([unit, bucket]) => (
            <div key={unit} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="font-medium capitalize">{unit.replace('_', ' ')}</h3>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Used {bucket.used} / {bucket.limit}</p>
              <div className="mt-2 h-2 rounded bg-gray-200 dark:bg-gray-700">
                <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, (bucket.used / Math.max(1, bucket.limit)) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs">Remaining: {bucket.remaining}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
