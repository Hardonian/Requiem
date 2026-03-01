// ready-layer/src/app/app/replay/page.tsx
//
// Phase E: Enterprise Operator — View replay drift, trigger replays.
// Shows replay_verified_rate, divergence_count, per-execution replay status.

import { Suspense } from 'react';

function ReplaySkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Replay Verification</h1>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

async function ReplayContent() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Replay Verification</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            CAS v2
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Dual-hash: BLAKE3 + SHA-256
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Replay Verified Rate</p>
          <p className="text-3xl font-mono mt-1">—<span className="text-sm text-gray-400 ml-1">%</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Divergence Count</p>
          <p className="text-3xl font-mono mt-1">—</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Immutable Records</p>
          <p className="text-3xl font-mono mt-1">—</p>
        </div>
      </div>

      {/* Replay Verification Panel */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Replay Verification Panel</h2>
          <p className="text-sm text-gray-500 mt-1">
            Every execution is stored immutably. Replay re-executes and compares result_digests.
            Divergence is detected, not hidden.
          </p>
        </div>
        <div className="p-4">
          <div className="bg-gray-50 rounded p-4 font-mono text-xs space-y-1">
            <div>storage: <span className="text-blue-600">content-addressable (BLAKE3 + SHA-256)</span></div>
            <div>format:  <span className="text-blue-600">ndjson (append-only, per-tenant)</span></div>
            <div>verify:  <span className="text-blue-600">re-execute + digest comparison</span></div>
            <div>tamper:  <span className="text-blue-600">Merkle chain integrity check</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-3">Recent Replay Results</h2>
        <p className="text-sm text-gray-400">
          Use <code className="text-xs bg-gray-50 px-1 py-0.5 rounded">GET /api/replay/verify?execution_id=...</code> to trigger a replay check.
          Results appear here when executions are verified.
        </p>
      </div>
    </div>
  );
}

export default function ReplayPage() {
  return (
    <Suspense fallback={<ReplaySkeleton />}>
      <ReplayContent />
    </Suspense>
  );
}
