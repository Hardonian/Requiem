// ready-layer/src/app/app/layout.tsx
//
// Shell layout for authenticated app routes (/app/*).
// Renders sidebar navigation with determinism, policy, and audit sections.
// INVARIANT: No direct engine calls here. Auth already verified by middleware.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_SECTIONS = [
  {
    label: "Execution",
    items: [
      { href: "/app/executions", label: "Executions" },
      { href: "/app/replay", label: "Replay" },
      { href: "/app/cas", label: "CAS Management" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/app/policy", label: "Policy Engine" },
      { href: "/app/audit", label: "Audit Ledger" },
      { href: "/app/signatures", label: "Artifact Signing", disabled: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/app/metrics", label: "Observability" },
      { href: "/app/diagnostics", label: "Doctor / Health" },
      { href: "/app/tenants", label: "Tenant Isolation" },
      { href: "/app/providers", label: "Foundational Models", disabled: true },
    ],
  },
] as const;

function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col py-8 px-4 shadow-[1px_0_0_0_rgba(0,0,0,0.02)]"
      aria-label="Main navigation"
    >
      <div className="mb-10 px-2 flex items-center space-x-3">
        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">
            Requiem
          </h1>
          <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-tighter">
            Provable Runtime
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-8">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400/80">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    {item.disabled ? (
                      <div className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-slate-300 cursor-not-allowed group">
                        <span>{item.label}</span>
                        <span className="text-[9px] bg-slate-50 border border-slate-100 px-1 rounded text-slate-400">
                          Pro
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          isActive
                            ? "bg-slate-900 text-white font-medium shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                        )}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-100 space-y-3">
        <div className="px-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Engine Status
            </p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono text-slate-700">
                v1.2.0-stable
              </span>
            </div>
          </div>
        </div>

        <div className="px-3 space-y-1.5">
          <Link
            href="/docs"
            className="flex items-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="w-1 h-1 rounded-full bg-slate-300 mr-2" />
            Documentation
          </Link>
          <Link
            href="https://github.com/Hardonian/Requiem"
            className="flex items-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="w-1 h-1 rounded-full bg-slate-300 mr-2" />
            GitHub Repository
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  );
}
