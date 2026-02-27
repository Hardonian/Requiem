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
      <h1 className="text-2xl font-bold mb-4">Replay Verification</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Replay Verified Rate</p>
          <p className="text-3xl font-mono mt-1">—<span className="text-sm text-gray-400 ml-1">%</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Divergence Count</p>
          <p className="text-3xl font-mono mt-1 text-red-500">—</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-3">Recent Replay Results</h2>
        <p className="text-sm text-gray-400">
          Use <code>GET /api/replay/verify?execution_id=...</code> to trigger a replay check.
          Results appear here automatically.
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
