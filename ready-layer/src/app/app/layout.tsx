// ready-layer/src/app/app/layout.tsx
//
// Shell layout for authenticated app routes (/app/*).
// Renders sidebar navigation with determinism, policy, and audit sections.
// INVARIANT: No direct engine calls here. Auth already verified by middleware.

import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV_SECTIONS = [
  {
    label: 'Execution',
    items: [
      { href: '/app/executions', label: 'Executions' },
      { href: '/app/replay', label: 'Replay' },
      { href: '/app/cas', label: 'CAS' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/app/policy', label: 'Policy' },
      { href: '/app/audit', label: 'Audit Log' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/app/metrics', label: 'Metrics' },
      { href: '/app/diagnostics', label: 'Diagnostics' },
      { href: '/app/tenants', label: 'Tenants' },
    ],
  },
] as const;

function Sidebar() {
  return (
    <nav
      className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col py-6 px-3"
      aria-label="Main navigation"
    >
      <div className="mb-8 px-2">
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Requiem
        </span>
        <span className="ml-1 text-xs text-slate-400 font-mono">
          provable-runtime
        </span>
      </div>
      <div className="flex-1 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="px-2 pt-4 border-t border-slate-100 space-y-1">
        <Link
          href="/app/metrics"
          className="block text-xs text-slate-400 hover:text-slate-600 font-mono"
        >
          determinism: enforced
        </Link>
        <Link
          href="/api/health"
          className="block text-xs text-slate-400 hover:text-slate-600 font-mono"
          target="_blank"
          rel="noopener noreferrer"
        >
          /api/health
        </Link>
      </div>
    </nav>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
    </div>
  );
}
