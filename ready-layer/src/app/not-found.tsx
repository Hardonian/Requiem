import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export default function NotFound() {
  return (
    <MarketingShell compact>
      <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <div className="w-14 h-14 bg-surface-elevated rounded-2xl flex items-center justify-center mb-5 border border-border">
          <span className="text-2xl font-bold text-muted font-mono">404</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground font-display sm:text-3xl">Page not found</h1>
        <p className="mt-3 max-w-xl text-muted text-sm leading-relaxed">
          The route you requested is unavailable or has moved. Use one of the verified navigation paths below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
          >
            Return home
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
          >
            Open docs
          </Link>
          <Link
            href="/app/executions"
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
