// ready-layer/src/app/app/diagnostics/page.tsx
//
// Engine diagnostics page — /app/diagnostics
// Shows system health checks, build metadata, and runtime status.
// All values reflect actual defaults; live data requires REQUIEM_API_URL.

import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Diagnostics',
  description: 'Engine health checks, determinism scoring, and system diagnostics.',
};

function DiagnosticsSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" role="status" aria-label="Loading diagnostics">
      <div className="h-8 w-56 bg-surface-elevated animate-pulse rounded-lg mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-64 bg-surface animate-pulse rounded-xl border border-border" />
        <div className="h-64 bg-surface animate-pulse rounded-xl border border-border" />
      </div>
    </div>
  );
}

async function DiagnosticsContent() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Engine Diagnostics</h1>
          <p className="text-muted text-sm mt-1">System health framing with explicit non-probed placeholders unless runtime checks are wired.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 bg-surface-elevated border border-border rounded-full text-[10px] font-bold text-muted uppercase tracking-widest">
            Node: STANDBY
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">System Health</h2>
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="divide-y divide-border">
              {[
                { check: 'Engine reachable', status: 'STANDBY', ok: false },
                { check: 'BLAKE3 hash available', status: 'SOURCE-INSPECTED', ok: false },
                { check: 'CAS backend accessible', status: 'NOT PROBED', ok: false },
                { check: 'Replay log writable', status: 'NOT PROBED', ok: false },
                { check: 'Audit log writable', status: 'NOT PROBED', ok: false },
              ].map((c) => (
                <div
                  key={c.check}
                  className="flex items-center justify-between p-4 px-5 hover:bg-surface-elevated/50 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">{c.check}</span>
                  <span
                    className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                      c.ok
                        ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-surface-elevated text-muted border border-border'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Build Metadata</h2>
          <div className="bg-foreground dark:bg-surface-elevated rounded-xl p-6 border border-border shadow-sm">
            <div className="space-y-4 font-mono">
              {[
                { key: 'engine_semver', val: '0.2.0-native' },
                { key: 'engine_abi_version', val: 'v1.4' },
                { key: 'hash_algorithm', val: 'BLAKE3 (v1)' },
                { key: 'cas_format', val: 'CAS-v2-LZ4' },
                { key: 'node_status', val: 'STANDBY — set REQUIEM_API_URL' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col border-b border-background/10 dark:border-border pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-[9px] text-background/40 dark:text-muted uppercase tracking-widest mb-1">
                    {item.key}
                  </span>
                  <span className="text-accent text-xs">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>


      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-muted">
        Statuses marked <span className="font-semibold text-foreground">NOT PROBED</span> or <span className="font-semibold text-foreground">SOURCE-INSPECTED</span> are not runtime health checks in this page.
      </div>

      <div className="p-5 bg-surface border border-border rounded-xl flex items-start gap-4">
        <div className="w-8 h-8 bg-surface-elevated border border-border rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-muted">
          Connect{' '}
          <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">REQUIEM_API_URL</code>{' '}
          to a live engine node to populate real-time diagnostics and metric traces.
        </p>
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <Suspense fallback={<DiagnosticsSkeleton />}>
      <DiagnosticsContent />
    </Suspense>
  );
}
