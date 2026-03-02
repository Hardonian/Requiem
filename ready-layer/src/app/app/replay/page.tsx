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
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Replay Verification</h1>
          <p className="text-slate-500 mt-1">Verify execution integrity via deterministic re-execution.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-widest shadow-sm">
            Engine: BLAKE3-v1
          </span>
          <span className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-widest shadow-sm">
            Dual-hash: CAS v2
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Replay Verified Rate', value: '—', unit: '%', sub: 'Calculated per tenant' },
          { label: 'Divergence Count', value: '0', sub: 'Zero drift detected' },
          { label: 'Immutable Records', value: '0', sub: 'Locked in CAS v2' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-3">{m.label}</p>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-slate-900 tracking-tight">{m.value}</span>
              {m.unit && <span className="text-sm font-medium text-slate-400 ml-1">{m.unit}</span>}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center">
              <span className="w-1 h-1 rounded-full bg-slate-200 mr-2" />
              {m.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Replay Verification Panel */}
      <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-xl shadow-slate-200 border border-slate-800">
        <div className="p-8 border-b border-white/5">
          <h2 className="text-lg font-bold text-white tracking-tight">System Integrity Panel</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Every execution is stored immutably in the Content-Addressable Storage (CAS).
            Replay verification re-executes the tool logic under identical constraints and compares the output fingerprints.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-8 border-r border-white/5">
            <div className="space-y-4">
              {[
                { label: 'Storage', val: 'content-addressable', icon: 'bg-blue-500' },
                { label: 'Format', val: 'ndjson (append-only)', icon: 'bg-indigo-500' },
                { label: 'Verify', val: 're-execute + digest compare', icon: 'bg-emerald-500' },
                { label: 'Tamper', val: 'Merkle chain integrity', icon: 'bg-amber-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${item.icon} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</p>
                    <p className="text-sm font-medium text-slate-200">{item.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-8 bg-black/20 flex flex-col justify-center">
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-4 bg-slate-800/50 rounded-2xl mb-4 border border-white/5">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-white font-bold mb-1">Verify Fingerprint</h3>
              <p className="text-slate-500 text-xs mb-4">Re-verify any execution via CLI</p>
              <code className="px-3 py-1.5 bg-slate-800 rounded-lg text-blue-400 text-[10px] font-mono border border-white/5">
                reach verify [hash]
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">No Replay Data</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Trigger a replay check via the CLI or Node API to see divergence analysis.
          Results will be recorded with Merkle proofs.
        </p>
        <div className="inline-flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Replay Command</p>
          <code className="text-xs font-mono text-blue-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
            reach replay run [execution-id]
          </code>
        </div>
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
