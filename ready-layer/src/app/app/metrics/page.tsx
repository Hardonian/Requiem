// ready-layer/src/app/app/metrics/page.tsx
//
// Phase E: Enterprise Operator — View memory + latency metrics, CAS efficiency.
// Shows p50/p95/p99 latency, CAS hit rate, determinism score on first load.
// No blank dashboard. INVARIANT: No direct engine call from this page.

import { Suspense } from 'react';

function MetricsSkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Metrics</h1>
      <div className="animate-pulse grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// EXTENSION_POINT: OpenTelemetry_exporter
// Wire real metrics from /api/engine/metrics when REQUIEM_API_URL is set.
async function MetricsDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Engine Metrics</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'p50 Latency', value: '—', unit: 'ms', key: 'latency.p50_ms' },
          { label: 'p95 Latency', value: '—', unit: 'ms', key: 'latency.p95_ms' },
          { label: 'p99 Latency', value: '—', unit: 'ms', key: 'latency.p99_ms' },
          { label: 'CAS Hit Rate', value: '—', unit: '%', key: 'cas.hit_rate' },
          { label: 'Determinism Score', value: '—', unit: '%', key: 'determinism.replay_verified_rate' },
          { label: 'Divergence Count', value: '—', unit: '', key: 'determinism.divergence_count' },
        ].map((m) => (
          <div key={m.key} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-3xl font-mono mt-1">
              {m.value}
              <span className="text-sm text-gray-400 ml-1">{m.unit}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400">
        Live data available when <code>REQUIEM_API_URL</code> is configured.{' '}
        <a href="https://reach-cli.com/docs/ready-layer" className="text-blue-500 underline">Setup docs</a>
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
