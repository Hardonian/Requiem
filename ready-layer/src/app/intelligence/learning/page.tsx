import type { ReactElement } from 'react';
import { getDashboard } from '@/lib/learning-store';

export default async function LearningDashboardPage(): Promise<ReactElement> {
  const tenantId = process.env.RL_TENANT_ID || 'public-hardonian';
  const data = getDashboard(tenantId);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Learning Dashboard</h1>
        <p className="text-sm text-slate-500">Deterministic learning funnel artifacts (prediction → outcome → error → calibration/weights).</p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries((data.counts as Record<string, number>)).map(([k, v]) => (
          <div key={k} className="rounded border p-3 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="text-xl font-semibold">{v}</div>
          </div>
        ))}
      </section>

      <section className="rounded border p-4 bg-white dark:bg-slate-900">
        <h2 className="font-medium mb-2">Quality Summary</h2>
        <div className="text-sm">Average MAE: <span className="font-semibold">{Number(data.avg_mae || 0).toFixed(6)}</span></div>
        <div className="text-xs text-slate-500 mt-2">Updated: {String(data.updated_at)}</div>
      </section>
    </main>
  );
}
