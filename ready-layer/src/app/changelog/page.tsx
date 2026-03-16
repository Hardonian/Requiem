import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Changelog | Requiem',
  description: 'Product and runtime release notes for Requiem.',
};

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Changelog</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Release notes
        </h1>
        <p className="mt-4 text-muted leading-relaxed">
          Platform changes, contract updates, and runtime release history.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Source of truth</p>
          <p className="text-muted text-sm leading-relaxed mb-4">
            Full release notes and contract updates are maintained in the repository changelog.
            Refer to{' '}
            <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">CHANGELOG.md</code>
            {' '}in the root for the canonical history of every runtime and API change.
          </p>
          <a
            href="https://github.com/reachhq/requiem/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            View CHANGELOG.md on GitHub
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/status"
            className="inline-flex items-center px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            System Status
          </Link>
          <Link
            href="/support"
            className="inline-flex items-center px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Support
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
