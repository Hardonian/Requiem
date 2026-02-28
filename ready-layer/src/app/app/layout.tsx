// ready-layer/src/app/app/layout.tsx
//
// Shell layout for authenticated app routes (/app/*).
// Renders the top nav and sidebar navigation.
// INVARIANT: No direct engine calls here. Auth already verified by middleware.

import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/app/executions', label: 'Executions' },
  { href: '/app/replay', label: 'Replay' },
  { href: '/app/cas', label: 'CAS' },
  { href: '/app/metrics', label: 'Metrics' },
  { href: '/app/diagnostics', label: 'Diagnostics' },
  { href: '/app/tenants', label: 'Tenants' },
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
          control-plane
        </span>
      </div>
      <ul className="space-y-0.5 flex-1">
        {NAV_ITEMS.map((item) => (
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
      <div className="px-2 pt-4 border-t border-slate-100">
        <Link
          href="/api/health"
          className="text-xs text-slate-400 hover:text-slate-600 font-mono"
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
