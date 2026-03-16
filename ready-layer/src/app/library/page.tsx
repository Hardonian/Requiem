import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Library | Requiem',
  description: 'Documentation, guides, and operational resources for Requiem.',
};

const resources = [
  {
    title: 'Quick Start Guide',
    description: 'Start with operator-oriented docs and first-run links.',
    href: '/docs',
  },
  {
    title: 'Architecture Overview',
    description: 'Understand the Requiem system design and components.',
    href: '/console/architecture',
  },
  {
    title: 'API Surface',
    description: 'Inspect the generated OpenAPI route contract.',
    href: '/api/openapi.json',
  },
  {
    title: 'CLI Operations',
    description: 'Run and verify workloads from the console entrypoint.',
    href: '/console',
  },
  {
    title: 'Policy Configuration',
    description: 'Configure governance policies and guardrails.',
    href: '/console/policies',
  },
  {
    title: 'Runtime Status',
    description: 'Check deployment health and runtime diagnostics.',
    href: '/status',
  },
  {
    title: 'Security Posture',
    description: 'Review implemented controls and disclosure guidance.',
    href: '/security',
  },
  {
    title: 'Support and Escalation',
    description: 'Contact support and review the service status feed.',
    href: '/support',
  },
];

export default function LibraryPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Library</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Documentation and operational resources.
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Guides, references, and direct links to Requiem operator surfaces.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 sm:px-6 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <Link
            key={resource.href}
            href={resource.href}
            className="bg-surface rounded-xl p-6 shadow-sm border border-border hover:shadow-md hover:border-border/80 transition-all"
          >
            <h3 className="text-base font-semibold text-foreground mb-2">
              {resource.title}
            </h3>
            <p className="text-sm text-muted">{resource.description}</p>
          </Link>
        ))}
      </section>
    </MarketingShell>
  );
}
