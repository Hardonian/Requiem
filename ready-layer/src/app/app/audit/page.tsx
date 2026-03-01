// ready-layer/src/app/app/audit/page.tsx
//
// Audit log dashboard — immutable execution history with export capability.
// Shows audit entries, Merkle chain integrity, and compliance export.
// INVARIANT: No direct engine calls. Data from /api/audit/logs.

import { Suspense } from 'react';

function AuditSkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Audit Log</h1>
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

async function AuditContent() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Append-only
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Merkle chain
          </span>
        </div>
      </div>

      {/* Audit Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Entries', value: '—' },
          { label: 'Chain Integrity', value: '—', sublabel: 'Merkle root' },
          { label: 'Last Entry', value: '—', sublabel: 'timestamp' },
          { label: 'Tenant Scope', value: '—', sublabel: 'active tenants' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-2xl font-mono mt-1">{m.value}</p>
            {m.sublabel && <p className="text-xs text-gray-400 mt-1">{m.sublabel}</p>}
          </div>
        ))}
      </div>

      {/* Export Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Compliance Export</h2>
            <p className="text-sm text-gray-500 mt-1">
              Export audit log entries with Merkle proofs for compliance review.
              Supports JSON and CSV formats.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/audit/logs?format=json&limit=1000"
              className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded font-mono transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Export JSON
            </a>
            <a
              href="/api/audit/logs?format=csv&limit=1000"
              className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded font-mono transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent Audit Entries</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-4">Timestamp</th>
              <th className="text-left py-2 px-4">Tenant</th>
              <th className="text-left py-2 px-4">Actor</th>
              <th className="text-left py-2 px-4">Action</th>
              <th className="text-left py-2 px-4">Resource</th>
              <th className="text-left py-2 px-4">Trace ID</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="py-8 text-center text-gray-400">
                Connect <code className="text-xs bg-gray-50 px-1 py-0.5 rounded">REQUIEM_API_URL</code> to populate audit entries.
                <br />
                <span className="text-xs mt-1 block">
                  Audit entries are immutable and append-only. Each entry is chained via Merkle proof.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
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
