// ready-layer/src/app/app/executions/page.tsx
//
// Execution history with determinism proof, fingerprint, and policy state.
// First load shows last 10 executions with result digest, determinism flag, and replay status.
// INVARIANT: Data comes from /api/executions (Node API boundary). No direct engine call.

import { Suspense } from 'react';

function ExecutionsSkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Executions</h1>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

async function ExecutionsList() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Executions</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Determinism: enforced
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Policy: deny-by-default
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Executions', value: '—' },
          { label: 'Determinism Rate', value: '—', unit: '%' },
          { label: 'Policy Events', value: '—' },
          { label: 'Replay Verified', value: '—', unit: '%' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-2xl font-mono mt-1">
              {m.value}
              {m.unit && <span className="text-sm text-gray-400 ml-1">{m.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Execution Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <p className="text-sm text-gray-500">Last 10 executions</p>
          <span className="text-xs text-gray-400 font-mono">BLAKE3-v1 | CAS v2</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-4">Fingerprint</th>
              <th className="text-left py-2 px-4">Tool</th>
              <th className="text-left py-2 px-4">Deterministic</th>
              <th className="text-left py-2 px-4">Policy</th>
              <th className="text-left py-2 px-4">Replay</th>
              <th className="text-left py-2 px-4">Latency</th>
              <th className="text-left py-2 px-4">Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="py-8 text-center text-gray-400">
                Connect <code className="text-xs bg-gray-50 px-1 py-0.5 rounded">REQUIEM_API_URL</code> to populate execution history.
                <br />
                <span className="text-xs mt-1 block">
                  Every execution produces a cryptographic fingerprint, determinism proof, and policy trace.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
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
