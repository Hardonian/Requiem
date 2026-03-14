// ready-layer/src/app/app/metrics/page.tsx
//
// Enterprise Operator — View memory + latency metrics, CAS efficiency.
// INVARIANT: No direct engine call from this page.

import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Observability',
  description: 'Engine performance metrics, determinism rates, and storage statistics.',
};

function MetricsSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" role="status" aria-label="Loading metrics">
      <div className="h-8 w-48 bg-surface-elevated animate-pulse rounded-lg mb-8" />
      <div className="space-y-8">
        {[1, 2, 3].map((section) => (
          <div key={section}>
            <div className="h-4 w-28 bg-surface-elevated animate-pulse rounded mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[104px] bg-surface animate-pulse rounded-xl border border-border" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function MetricsDashboard() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Engine Metrics</h1>
          <p className="text-muted text-sm mt-1">Performance, determinism, and storage overview.</p>
        </div>
        <span className="text-xs text-muted font-mono">BLAKE3-v1 | CAS v2 | deny-by-default</span>
      </div>

      {/* Determinism Metrics */}
      <section className="mb-8" aria-labelledby="determinism-heading">
        <h2 id="determinism-heading" className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Determinism</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Determinism Rate', value: '\u2014', unit: '%' },
            { label: 'Replay Verified', value: '\u2014', unit: '%' },
            { label: 'Divergence Count', value: '\u2014' },
          ].map((m) => (
            <div key={m.label} className="stitch-stat">
              <p className="stitch-stat-label">{m.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="stitch-stat-value font-mono">{m.value}</span>
                {m.unit && <span className="text-sm font-medium text-muted">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="mb-8" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'p50 Latency', value: '\u2014', unit: 'ms' },
            { label: 'p95 Latency', value: '\u2014', unit: 'ms' },
            { label: 'p99 Latency', value: '\u2014', unit: 'ms' },
          ].map((m) => (
            <div key={m.label} className="stitch-stat">
              <p className="stitch-stat-label">{m.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="stitch-stat-value font-mono">{m.value}</span>
                {m.unit && <span className="text-sm font-medium text-muted">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Storage & Usage */}
      <section className="mb-8" aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Storage &amp; Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'CAS Hit Rate', value: '\u2014', unit: '%' },
            { label: 'Replay Storage', value: '\u2014' },
            { label: 'Policy Events', value: '\u2014' },
          ].map((m) => (
            <div key={m.label} className="stitch-stat">
              <p className="stitch-stat-label">{m.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="stitch-stat-value font-mono">{m.value}</span>
                {m.unit && <span className="text-sm font-medium text-muted">{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted">
        Live data available when <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">REQUIEM_API_URL</code> is configured.
      </p>
    </div>
  );
}

export default function MetricsPage() {
  return (
    <Suspense fallback={<MetricsSkeleton />}>
      <MetricsDashboard />
    </Suspense>
  );
}
