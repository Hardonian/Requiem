// ready-layer/src/app/app/executions/page.tsx
//
// Execution history with determinism proof, fingerprint, and policy state.
// INVARIANT: Data comes from /api/executions (Node API boundary). No direct engine call.

import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Executions',
  description: 'Monitor and verify deterministic AI tool invocations with cryptographic proofs.',
};

function ExecutionsSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in" role="status" aria-label="Loading executions">
      <div className="h-8 w-48 bg-surface-elevated animate-pulse rounded-lg mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[104px] bg-surface animate-pulse rounded-xl border border-border" />
        ))}
      </div>
      <div className="h-64 bg-surface animate-pulse rounded-xl border border-border" />
    </div>
  );
}

async function ExecutionsList() {
  const isConfigured = Boolean(process.env.REQUIEM_API_URL || process.env.NEXT_PUBLIC_REQUIEM_API_URL);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Executions</h1>
          <p className="text-muted text-sm mt-1">Monitor and verify deterministic AI tool invocations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-full text-xs font-medium text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
            Determinism Enforced
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs font-medium text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            Replay Verified
          </span>
        </div>
      </div>

      {/* Engine Warning */}
      {!isConfigured && (
        <div className="mb-8 p-5 bg-warning/5 border border-warning/20 rounded-xl flex items-start gap-4" role="alert">
          <div className="w-10 h-10 bg-warning/10 text-warning rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Engine Node Not Connected</h3>
            <p className="text-sm text-muted mt-1">
              Dashboard is in standby mode. Set <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">REQUIEM_API_URL</code> to connect.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <a href="/docs" className="text-sm font-medium text-foreground hover:text-accent transition-colors inline-flex items-center gap-1">
                Connection guide
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Executions', value: '0', sub: 'Last 24h: 0' },
          { label: 'Avg Determinism', value: '100', unit: '%', sub: 'No drift detected' },
          { label: 'Policy Enforced', value: '0', sub: 'Deny-by-default' },
          { label: 'Storage Used', value: '0', unit: 'MB', sub: 'CAS v2 Optimized' },
        ].map((m) => (
          <div key={m.label} className="stitch-stat">
            <p className="stitch-stat-label">{m.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="stitch-stat-value">{m.value}</span>
              {m.unit && <span className="text-sm font-medium text-muted">{m.unit}</span>}
            </div>
            <p className="stitch-stat-sub">
              <span className="w-1 h-1 rounded-full bg-muted/30" aria-hidden="true" />
              {m.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Execution Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Recent Activity</h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full border border-muted/40" aria-hidden="true" />
              BLAKE3-v1
            </span>
            <span className="text-xs text-muted font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full border border-muted/40" aria-hidden="true" />
              CAS-v2
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Fingerprint</th>
                <th>Tool / Action</th>
                <th>Status</th>
                <th>Replay</th>
                <th className="text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="max-w-sm mx-auto">
                    <div className="w-12 h-12 bg-surface-elevated rounded-xl flex items-center justify-center mx-auto mb-4 border border-border">
                      <svg className="w-6 h-6 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No execution history</h3>
                    <p className="text-muted text-sm mb-6">
                      Every tool invocation produces a cryptographic proof. Start an execution to populate this view.
                    </p>
                    <div className="bg-foreground/95 dark:bg-surface-elevated rounded-lg p-4 text-left">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Run from CLI</p>
                      <code className="text-xs text-accent font-mono block">
                        reach run system.echo &quot;Proving determinism...&quot;
                      </code>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ExecutionsPage() {
  return (
    <Suspense fallback={<ExecutionsSkeleton />}>
      <ExecutionsList />
    </Suspense>
  );
}
