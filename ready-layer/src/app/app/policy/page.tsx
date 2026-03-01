// ready-layer/src/app/app/policy/page.tsx
//
// Policy enforcement dashboard — shows active policy state,
// enforcement mode, violation timeline, and rule configuration.
// INVARIANT: No direct engine calls. Data from /api routes.

import { Suspense } from 'react';

function PolicySkeleton() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Policy Enforcement</h1>
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

async function PolicyContent() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Policy Enforcement</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Enforced
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            Deny-by-default
          </span>
        </div>
      </div>

      {/* Enforcement Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Enforcement Mode', value: 'DENY', sublabel: 'deny-by-default' },
          { label: 'Policy Events', value: '—', sublabel: 'total' },
          { label: 'Violations Blocked', value: '—', sublabel: 'prevented' },
          { label: 'Last Violation', value: '—', sublabel: 'timestamp' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-2xl font-mono mt-1">{m.value}</p>
            <p className="text-xs text-gray-400 mt-1">{m.sublabel}</p>
          </div>
        ))}
      </div>

      {/* Active Rules */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Active Policy Rules</h2>
        </div>
        <div className="divide-y">
          {[
            { rule: 'Budget Enforcement', status: 'active', desc: 'Token and cost limits per tenant' },
            { rule: 'RBAC Capabilities', status: 'active', desc: 'Role-based tool access control' },
            { rule: 'Content Guardrails', status: 'active', desc: 'Prompt injection and output filtering' },
            { rule: 'Rate Limiting', status: 'active', desc: '100 req/min, 10K tokens/min per tenant' },
            { rule: 'SSRF Protection', status: 'active', desc: 'Blocks localhost, private IPs' },
            { rule: 'Side-Effect Restriction', status: 'active', desc: 'VIEWER role cannot execute write tools' },
          ].map((r) => (
            <div key={r.rule} className="flex items-center justify-between p-3 px-4">
              <div>
                <span className="text-sm font-medium">{r.rule}</span>
                <p className="text-xs text-gray-400">{r.desc}</p>
              </div>
              <span className="text-xs font-mono text-green-600 bg-green-50 px-2 py-1 rounded">
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Enterprise Mode Toggle */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Enterprise Mode</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enables SOC 2 controls, signed artifacts, and advanced policy engine (DGL, CPX, SCCL).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">REQUIEM_ENTERPRISE</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              off
            </span>
          </div>
        </div>
      </div>

      {/* Violation Timeline */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-3">Policy Violation Timeline</h2>
        <p className="text-sm text-gray-400">
          Violations appear here when policy gates deny execution requests.
          Connect <code className="text-xs bg-gray-50 px-1 py-0.5 rounded">REQUIEM_API_URL</code> to populate live data.
        </p>
      </div>
    </div>
  );
}

export default function PolicyPage() {
  return (
    <Suspense fallback={<PolicySkeleton />}>
      <PolicyContent />
    </Suspense>
  );
}
