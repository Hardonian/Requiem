import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Request Demo | Requiem',
  description: 'Book a Requiem demo and share your deployment requirements.',
};

export default function EnterpriseRequestDemoPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Enterprise</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Request a Requiem demo
        </h1>
        <p className="mt-4 text-muted leading-relaxed">
          We run demos from the same OSS runtime and control-plane flows shown in this repository.
          Share your use case, scale requirements, and compliance expectations, and we&apos;ll route you
          to the right operator.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 space-y-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="font-semibold text-foreground mb-3">How to proceed</p>
          <ul className="space-y-2 text-sm text-muted">
            {[
              'Start with the support form for scheduling and discovery.',
              'Include tenant count, expected run volume, and residency constraints.',
              'Attach architecture questions so we can map the demo to your stack.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-muted/40 mt-1.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/support/contact"
            className="inline-flex items-center px-5 py-2.5 bg-success hover:brightness-110 text-foreground rounded-lg text-sm font-semibold transition-all"
          >
            Contact support
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Back to pricing
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
