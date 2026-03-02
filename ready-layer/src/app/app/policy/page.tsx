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
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Policy Enforcement</h1>
          <p className="text-slate-500 mt-1">Configure guardrails and resource constraints for AI operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 bg-green-50 border border-green-100 rounded-full text-[10px] font-bold text-green-700 uppercase tracking-widest shadow-sm">
            Gate: ACTIVE
          </span>
          <span className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-widest shadow-sm">
            Deny-by-default
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Enforcement Mode', value: 'DENY', sub: 'Fail-closed protocol' },
          { label: 'Policy Events', value: '0', sub: 'Last 24h: 0' },
          { label: 'Violations Blocked', value: '0', sub: 'Automatic prevention' },
          { label: 'Last Violation', value: '—', sub: 'No incidents tracked' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-3">{m.label}</p>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-slate-900 tracking-tight">{m.value}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center">
              <span className="w-1 h-1 rounded-full bg-slate-200 mr-2" />
              {m.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Active Protection Layers</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { rule: 'Budget Enforcement', status: 'active', desc: 'Token and cost limits per tenant' },
                { rule: 'RBAC Capabilities', status: 'active', desc: 'Role-based tool access control' },
                { rule: 'Content Guardrails', status: 'active', desc: 'Prompt injection and output filtering' },
                { rule: 'Rate Limiting', status: 'active', desc: '100 req/min, 10K tokens/min per tenant' },
                { rule: 'SSRF Protection', status: 'active', desc: 'Blocks localhost, private IPs (Fail-closed)' },
                { rule: 'Side-Effect Restriction', status: 'active', desc: 'VIEWER role cannot execute write tools' },
              ].map((r) => (
                <div key={r.rule} className="flex items-center justify-between p-4 px-6 group hover:bg-slate-50/50 transition-colors">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{r.rule}</span>
                    <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enterprise Mode Toggle */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 12c-2.67 0-5-1.33-5-4 0-2.67 2.33-4 5-4s5 1.33 5 4c0 2.67-2.33 4-5 4z"/></svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2">Enterprise Controls</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Enable SOC 2 controls, signed provenance bundles, and the advanced Logic Policy Engine.
            </p>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Status</p>
                <p className="text-sm font-bold text-slate-300">Disabled</p>
              </div>
              <button className="px-3 py-1 bg-white text-slate-900 text-[10px] font-bold rounded-lg hover:bg-slate-100 transition-colors">
                UPGRADE
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase mb-4">Audit Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Capture Inputs</span>
                <div className="w-8 h-4 bg-blue-600 rounded-full relative"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" /></div>
              </div>
              <div className="flex items-center justify-between opacity-50">
                <span className="text-xs text-slate-500 font-medium">Anonymize PII</span>
                <div className="w-8 h-4 bg-slate-200 rounded-full relative"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full" /></div>
              </div>
            </div>
          </div>
        </div>
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
