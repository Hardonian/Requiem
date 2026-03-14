// ready-layer/src/app/app/audit/page.tsx
//
// Audit log dashboard — immutable execution history with export capability.
// INVARIANT: No direct engine calls. Data from /api/audit/logs.

import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Audit Ledger',
  description: 'Immutable, Merkle-chained audit log with compliance export.',
};

function AuditSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" role="status" aria-label="Loading audit log">
      <div className="h-8 w-40 bg-surface-elevated animate-pulse rounded-lg mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[104px] bg-surface animate-pulse rounded-xl border border-border" />
        ))}
      </div>
      <div className="h-64 bg-surface animate-pulse rounded-xl border border-border" />
    </div>
  );
}

async function AuditContent() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Audit Ledger</h1>
          <p className="text-muted text-sm mt-1">Immutable, hash-chained event log with compliance export.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-full text-xs font-medium text-success">
            Append-only
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs font-medium text-accent">
            Merkle chain
          </span>
        </div>
      </div>

      {/* Audit Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Entries', value: '\u2014' },
          { label: 'Chain Integrity', value: '\u2014', sub: 'Merkle root' },
          { label: 'Last Entry', value: '\u2014', sub: 'timestamp' },
          { label: 'Tenant Scope', value: '\u2014', sub: 'active tenants' },
        ].map((m) => (
          <div key={m.label} className="stitch-stat">
            <p className="stitch-stat-label">{m.label}</p>
            <span className="stitch-stat-value font-mono">{m.value}</span>
            {m.sub && <p className="stitch-stat-sub">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Export Controls */}
      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Compliance Export</h2>
            <p className="text-sm text-muted mt-1">
              Export audit entries with Merkle proofs. Supports JSON and CSV.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/audit/logs?format=json&limit=1000"
              className="inline-flex items-center px-3 py-1.5 text-sm bg-surface-elevated hover:bg-border/50 border border-border rounded-lg font-mono transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Export JSON
            </a>
            <a
              href="/api/audit/logs?format=csv&limit=1000"
              className="inline-flex items-center px-3 py-1.5 text-sm bg-surface-elevated hover:bg-border/50 border border-border rounded-lg font-mono transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="stitch-section-header">
          <h2 className="stitch-section-title">Recent Audit Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Tenant</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Trace ID</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="max-w-sm mx-auto">
                    <svg className="mx-auto h-10 w-10 text-muted/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
                    </svg>
                    <p className="text-sm text-muted">
                      Set <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">REQUIEM_API_URL</code> to populate audit entries.
                    </p>
                    <p className="text-xs text-muted/70 mt-2">
                      Entries are immutable and append-only. Each is chained via Merkle proof.
                    </p>
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

export default function AuditPage() {
  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditContent />
    </Suspense>
  );
}
