'use client';

import type { ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Bot,
  CircleDollarSign,
  Gauge,
  Globe,
  Home,
  KeyRound,
  LayoutGrid,
  List,
  Network,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { routeMaturityCatalog, type NavStatus } from '@/lib/route-maturity';

const iconByPath: Record<string, ComponentType<{ className?: string }>> = {
  '/console/overview': Home,
  '/console/architecture': LayoutGrid,
  '/console/guarantees': ShieldCheck,
  '/console/replication': Globe,
  '/console/logs': List,
  '/console/runs': Bot,
  '/console/plans': ScrollText,
  '/console/policies': Scale,
  '/console/capabilities': KeyRound,
  '/console/finops': Wallet,
  '/console/snapshots': Gauge,
  '/registry': Network,
  '/spend': CircleDollarSign,
  '/drift': Bot,
  '/settings': Settings,
};

const statusClass: Record<NavStatus, string> = {
  primary: 'border-success/30 bg-success/10 text-success',
  degraded: 'border-warning/30 bg-warning/10 text-warning',
  demo: 'border-accent/30 bg-accent/10 text-accent',
  info: 'border-border bg-surface-elevated text-muted',
};

const statusLabel: Record<NavStatus, string> = {
  primary: 'Live',
  degraded: 'Degraded',
  demo: 'Demo',
  info: 'Info',
};

const platformNavItems = routeMaturityCatalog.filter((route) => route.navGroup === 'platform');
const operationsNavItems = routeMaturityCatalog.filter((route) => route.navGroup === 'operations');

function NavLink({ item }: { item: (typeof routeMaturityCatalog)[number] }) {
  const pathname = usePathname();
  const isActive = pathname === item.path || pathname?.startsWith(`${item.path}/`);
  const Icon = iconByPath[item.path] ?? Home;

  return (
    <Link
      href={item.path}
      aria-current={isActive ? 'page' : undefined}
      className={`group flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:bg-surface-elevated hover:text-foreground'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted group-hover:text-foreground/80'}`} aria-hidden="true" />
        <span className="truncate">{item.navLabel}</span>
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusClass[item.navStatus]}`}>
        {statusLabel[item.navStatus]}
      </span>
    </Link>
  );
}

export function ConsoleNavigation() {
  return (
    <nav className="flex min-h-screen w-72 flex-col border-r border-border bg-surface" aria-label="Console navigation">
      <div className="border-b border-border p-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">R</div>
          <div>
            <span className="block text-base font-bold leading-none text-foreground">Requiem</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Console</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-3">
        <div role="group" aria-label="Platform">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">Platform</div>
          <div className="space-y-0.5">
            {platformNavItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>
        </div>

        <div role="group" aria-label="Operations">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">Operations</div>
          <div className="space-y-0.5">
            {operationsNavItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <Link href="/docs" className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Documentation
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
