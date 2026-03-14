import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Runs',
  description: 'Track run receipts, policy outcomes, and replay verification checks.',
};

export default function RunsPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        <h1 className="text-2xl font-bold text-foreground font-display tracking-tight">Runs</h1>
        <p className="mt-2 text-muted text-sm leading-relaxed">
          Track run receipts, policy outcomes, and replay checks.
        </p>
        <Link
          href="/console/runs"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Open Console Runs
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </MarketingShell>
  );
}
