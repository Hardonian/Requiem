// ready-layer/src/app/app/policy/page.tsx
//
// Policy enforcement dashboard — shows active policy state,
// enforcement mode, violation timeline, and rule configuration.
// INVARIANT: No direct engine calls. Data from /api routes.

import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Policy Engine',
  description: 'Configure guardrails and resource constraints for AI operations.',
};

function PolicySkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" role="status" aria-label="Loading policy dashboard">
      <div className="h-8 w-56 bg-surface-elevated animate-pulse rounded-lg mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[104px] bg-surface animate-pulse rounded-xl border border-border" />
        ))}
      </div>
      <div className="h-80 bg-surface animate-pulse rounded-xl border border-border" />
    </div>
  );
}

async function PolicyContent() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Policy Enforcement</h1>
          <p className="text-muted text-sm mt-1">Configure guardrails and resource constraints for AI operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-full text-xs font-medium text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            Gate: Active
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border rounded-full text-xs font-medium text-muted">
            Deny-by-default
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Enforcement Mode', value: 'DENY', sub: 'Fail-closed protocol' },
          { label: 'Policy Events', value: '0', sub: 'Last 24h: 0' },
          { label: 'Violations Blocked', value: '0', sub: 'Automatic prevention' },
          { label: 'Last Violation', value: '\u2014', sub: 'No incidents tracked' },
        ].map((m) => (
          <div key={m.label} className="stitch-stat">
            <p className="stitch-stat-label">{m.label}</p>
            <span className="stitch-stat-value">{m.value}</span>
            <p className="stitch-stat-sub">
              <span className="w-1 h-1 rounded-full bg-muted/30" aria-hidden="true" />
              {m.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protection Layers */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="stitch-section-header">
              <h2 className="stitch-section-title">Active Protection Layers</h2>
            </div>
            <div className="divide-y divide-border">
              {[
                { rule: 'Budget Enforcement', desc: 'Token and cost limits per tenant' },
                { rule: 'RBAC Capabilities', desc: 'Role-based tool access control' },
                { rule: 'Content Guardrails', desc: 'Prompt injection and output filtering' },
                { rule: 'Rate Limiting', desc: '100 req/min, 10K tokens/min per tenant' },
                { rule: 'SSRF Protection', desc: 'Blocks localhost, private IPs (fail-closed)' },
                { rule: 'Side-Effect Restriction', desc: 'VIEWER role cannot execute write tools' },
              ].map((r) => (
                <div key={r.rule} className="flex items-center justify-between p-4 px-5 hover:bg-surface-elevated/50 transition-colors">
                  <div>
                    <span className="text-sm font-medium text-foreground">{r.rule}</span>
                    <p className="text-xs text-muted mt-0.5">{r.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
                    <span className="text-xs font-medium text-success">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Enterprise Controls */}
          <div className="bg-foreground dark:bg-surface rounded-xl p-5 text-background dark:text-foreground shadow-lg border border-transparent dark:border-border relative overflow-hidden">
            <h2 className="text-base font-bold tracking-tight mb-2">Enterprise Controls</h2>
            <p className="text-background/60 dark:text-muted text-xs leading-relaxed mb-5">
              Enable SOC 2 controls, signed provenance bundles, and the advanced Logic Policy Engine.
            </p>
            <div className="bg-background/5 dark:bg-surface-elevated rounded-lg p-4 border border-background/10 dark:border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-background/40 dark:text-muted uppercase tracking-wider mb-0.5">Status</p>
                <p className="text-sm font-medium text-background/70 dark:text-muted">Disabled</p>
              </div>
              <button className="px-3 py-1.5 bg-background dark:bg-accent text-foreground dark:text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
                Upgrade
              </button>
            </div>
          </div>

          {/* Audit Settings */}
          <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Audit Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted font-medium" id="capture-inputs-label">Capture Inputs</label>
                <div
                  className="w-8 h-4 bg-accent rounded-full relative cursor-pointer"
                  role="switch"
                  aria-checked="true"
                  aria-labelledby="capture-inputs-label"
                  tabIndex={0}
                >
                  <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform" />
                </div>
              </div>
              <div className="flex items-center justify-between opacity-60">
                <label className="text-xs text-muted font-medium" id="anonymize-pii-label">Anonymize PII</label>
                <div
                  className="w-8 h-4 bg-border rounded-full relative cursor-pointer"
                  role="switch"
                  aria-checked="false"
                  aria-labelledby="anonymize-pii-label"
                  tabIndex={0}
                >
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform" />
                </div>
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
