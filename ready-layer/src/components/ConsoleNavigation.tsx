'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// Platform/Overview section (Stitch pages)
const platformNavItems: NavItem[] = [
  { label: 'Overview', href: '/console/overview', icon: <span>🏠</span> },
  { label: 'Architecture', href: '/console/architecture', icon: <span>🏗️</span> },
  { label: 'Guarantees', href: '/console/guarantees', icon: <span>🛡️</span> },
  { label: 'Replication', href: '/console/replication', icon: <span>🌐</span> },
];

// Operations section
const navItems: NavItem[] = [
  { label: 'Logs', href: '/console/logs', icon: <span>📜</span> },
  { label: 'Runs', href: '/console/runs', icon: <span>▶️</span> },
  { label: 'Plans', href: '/console/plans', icon: <span>🧭</span> },
  { label: 'Policies', href: '/console/policies', icon: <span>🔒</span> },
  { label: 'Capabilities', href: '/console/capabilities', icon: <span>🔑</span> },
  { label: 'FinOps', href: '/console/finops', icon: <span>💳</span> },
  { label: 'Snapshots', href: '/console/snapshots', icon: <span>📸</span> },
  { label: 'Registry', href: '/registry', icon: <span>📦</span> },
  { label: 'Spend', href: '/spend', icon: <span>📈</span> },
  { label: 'Drift', href: '/drift', icon: <span>🧬</span> },
  { label: 'Settings', href: '/settings', icon: <span>⚙️</span> },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
  
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export function ConsoleNavigation() {
  return (
    <nav className="flex min-h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">R</div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">ReadyLayer</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Platform Section */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Platform
          </div>
          <div className="space-y-1">
            {platformNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        {/* Operations Section */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Operations
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-200 p-4 dark:border-gray-700">
        <Link
          href="/docs"
          className="text-sm text-gray-500 transition-colors hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400"
        >
          Documentation
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
