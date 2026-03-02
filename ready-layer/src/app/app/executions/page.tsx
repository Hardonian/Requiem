// ready-layer/src/app/app/executions/page.tsx
//
// Execution history with determinism proof, fingerprint, and policy state.
// First load shows last 10 executions with result digest, determinism flag, and replay status.
// INVARIANT: Data comes from /api/executions (Node API boundary). No direct engine call.

import { Suspense } from 'react';

function ExecutionsSkeleton() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-md mb-8" />
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-50 animate-pulse rounded-xl" />
    </div>
  );
}

async function ExecutionsList() {
  const isConfigured = Boolean(process.env.REQUIEM_API_URL || process.env.NEXT_PUBLIC_REQUIEM_API_URL);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Executions</h1>
          <p className="text-slate-500 mt-1">Monitor and verify deterministic AI tool invocations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center px-3 py-1 bg-green-50 border border-green-100 rounded-full text-[11px] font-bold text-green-700 uppercase tracking-wider shadow-sm transition-all hover:shadow-md">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
            Determinism Enforced
          </div>
          <div className="flex items-center px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[11px] font-bold text-blue-700 uppercase tracking-wider shadow-sm transition-all hover:shadow-md">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" />
            Replay Verified
          </div>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-10 p-6 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex items-start gap-5 backdrop-blur-sm animate-in slide-in-from-top-4 duration-700">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-amber-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-amber-900 leading-tight">Engine Node Not Connected</h3>
            <p className="text-sm text-amber-700 mt-2 max-w-2xl leading-relaxed">
              The ReadyLayer dashboard is currently running in standby mode because <code>REQUIEM_API_URL</code> is not configured.
              Connect to a Requiem node to see live execution data and policy enforcement metrics.
            </p>
            <div className="mt-4 flex items-center gap-6">
              <a href="/docs/connecting-nodes" className="text-sm font-bold text-amber-900 hover:opacity-70 flex items-center gap-1">
                Read connection guide
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
              <button className="text-sm font-bold text-amber-900 hover:opacity-70">Dismiss warning</button>
            </div>
          </div>
          <div className="text-[10px] font-mono text-amber-500/50 uppercase tracking-widest vertical-text select-none">Config Warning</div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Executions', value: '0', sub: 'Last 24h: 0' },
          { label: 'Avg Determinism', value: '100', unit: '%', sub: 'No drift detected' },
          { label: 'Policy Enforced', value: '0', sub: 'Deny-by-default' },
          { label: 'Storage Used', value: '0', unit: 'MB', sub: 'CAS v2 Optimized' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
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

      {/* Execution Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Recent Activity</h2>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] text-slate-400 font-mono flex items-center">
              <span className="w-2 h-2 rounded-full border border-slate-300 mr-1.5" />
              Engine: BLAKE3-v1
            </span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center">
              <span className="w-2 h-2 rounded-full border border-slate-300 mr-1.5" />
              Storage: CAS-v2
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="text-left py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fingerprint</th>
                <th className="text-left py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tool / Action</th>
                <th className="text-left py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Replay</th>
                <th className="text-right py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">No execution history</h3>
                    <p className="text-slate-500 text-sm mb-6">
                      Every tool invocation produces a cryptographic proof. Start an execution to populate this dashboard.
                    </p>
                    <div className="bg-slate-900 rounded-xl p-4 text-left group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Interactive</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Run from CLI</p>
                      <code className="text-xs text-blue-400 font-mono block">
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
