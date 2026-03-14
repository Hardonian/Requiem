import type { ReactNode } from 'react';
import Link from 'next/link';
import { marketingFooterGroups, marketingNavLinks } from '@/lib/marketing';

type MarketingShellProps = {
  children: ReactNode;
  compact?: boolean;
};

export function MarketingShell({ children, compact = false }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-base font-semibold tracking-tight text-slate-900">
            Requiem
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            {marketingNavLinks.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/demo"
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Try demo
          </Link>
        </div>
      </header>
      <main className={compact ? '' : 'pb-16'}>{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Requiem</p>
            <p className="mt-2 text-sm text-slate-600">Deterministic agent compute with replayable evidence.</p>
          </div>
          {marketingFooterGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold text-slate-900">{group.title}</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link className="transition-colors hover:text-slate-900" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
