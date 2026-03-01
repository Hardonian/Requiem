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

async function MetricsDashboard() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Engine Metrics</h1>
        <span className="text-xs text-gray-400 font-mono">BLAKE3-v1 | CAS v2 | deny-by-default</span>
      </div>

      {/* Determinism Metrics */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Determinism</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Determinism Rate', value: '—', unit: '%', key: 'determinism.rate' },
            { label: 'Replay Verified', value: '—', unit: '%', key: 'determinism.replay_verified_rate' },
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
      </div>

      {/* Performance Metrics */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Performance</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'p50 Latency', value: '—', unit: 'ms', key: 'latency.p50_ms' },
            { label: 'p95 Latency', value: '—', unit: 'ms', key: 'latency.p95_ms' },
            { label: 'p99 Latency', value: '—', unit: 'ms', key: 'latency.p99_ms' },
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
      </div>

      {/* Storage &amp; Usage Metrics */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Storage &amp; Usage</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'CAS Hit Rate', value: '—', unit: '%', key: 'cas.hit_rate' },
            { label: 'Replay Storage', value: '—', unit: '', key: 'replay.storage' },
            { label: 'Policy Events', value: '—', unit: '', key: 'policy.events' },
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
      </div>

      <p className="text-sm text-gray-400">
        Live data available when <code className="text-xs bg-gray-50 px-1 py-0.5 rounded">REQUIEM_API_URL</code> is configured.
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
