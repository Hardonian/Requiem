import type { ReactNode } from 'react';
import Link from 'next/link';
import { marketingFooterGroups, marketingNavLinks } from '@/lib/marketing';

type MarketingShellProps = {
  children: ReactNode;
  compact?: boolean;
};

export function MarketingShell({ children, compact = false }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Requiem home">
            <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-xs">R</span>
            </div>
            <span className="text-base font-bold tracking-tight text-foreground font-display">
              Requiem
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Main navigation">
            {marketingNavLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted transition-colors hover:text-foreground font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/app/executions"
              className="hidden sm:inline-flex items-center text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:opacity-90"
            >
              Try demo
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={compact ? '' : 'pb-16'}>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-foreground rounded-md flex items-center justify-center">
                <span className="text-background font-bold text-[10px]">R</span>
              </div>
              <p className="text-sm font-bold text-foreground font-display">Requiem</p>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Deterministic agent compute with cryptographic receipts and replayable evidence.
            </p>
            <p className="text-xs text-muted/60 mt-4">
              &copy; {new Date().getFullYear()} Hardonian. All rights reserved.
            </p>
          </div>
          {marketingFooterGroups.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{group.title}</p>
              <ul className="space-y-2 text-sm" role="list">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link className="text-muted transition-colors hover:text-foreground" href={link.href}>
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
