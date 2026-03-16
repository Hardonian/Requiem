import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getDashboard } from '@/lib/learning-store';

export const metadata: Metadata = {
  title: 'Learning',
  description: 'Deterministic learning funnel metrics — prediction, outcome, calibration, and weight artifacts.',
};

export default async function LearningDashboardPage(): Promise<ReactElement> {
  const tenantId = process.env.RL_TENANT_ID || 'public';
  const data = getDashboard(tenantId);
  const counts = data.counts as Record<string, number>;
  const avgMae = Number(data.avg_mae || 0);
  const hasData = Object.values(counts).some((v) => v > 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Learning
          </h1>
          <p className="text-muted text-sm mt-1">
            Deterministic learning funnel: prediction &rarr; outcome &rarr; error &rarr; calibration &rarr; weights.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
          Tenant: <span className="font-mono ml-1">{tenantId}</span>
        </span>
      </div>

      {!hasData && (
        <div className="mb-8 p-5 bg-surface border border-border rounded-xl flex items-start gap-4">
          <div className="w-8 h-8 bg-surface-elevated border border-border rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-muted">
            No learning artifacts found. Set{' '}
            <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">REQUIEM_LEARNING_DIR</code>{' '}
            to load stored data.
          </p>
        </div>
      )}

      <section className="mb-8" aria-labelledby="counts-heading">
        <h2 id="counts-heading" className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          Pipeline Counts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="stitch-stat">
              <p className="stitch-stat-label">{k}</p>
              <span className="stitch-stat-value font-mono">{v > 0 ? v : '\u2014'}</span>
            </div>
          ))}
          {Object.keys(counts).length === 0 && (
            <div className="stitch-stat col-span-5">
              <p className="stitch-stat-label">No pipeline stages recorded</p>
              <span className="stitch-stat-value font-mono">&mdash;</span>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="quality-heading">
        <h2 id="quality-heading" className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          Quality Summary
        </h2>
        <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted mb-1">Average MAE</p>
              <p className="text-2xl font-bold tracking-tight text-foreground font-display font-mono">
                {hasData ? avgMae.toFixed(6) : '\u2014'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-1">Last Updated</p>
              <p className="text-sm font-mono text-muted">{String(data.updated_at)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
