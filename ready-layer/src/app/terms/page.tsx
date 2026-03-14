import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing use of Requiem and ReadyLayer services.',
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Terms of Service</h1>
        <p className="mt-4 text-muted leading-relaxed">
          Use of ReadyLayer requires compliance with tenant isolation, capability controls,
          and replay verification constraints.
        </p>
        <p className="mt-4 text-muted leading-relaxed">
          All executions are subject to policy enforcement and audit logging as configured
          by your organization&apos;s governance settings.
        </p>
      </article>
    </MarketingShell>
  );
}
