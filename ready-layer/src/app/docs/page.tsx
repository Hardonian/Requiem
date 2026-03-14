import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Documentation | Requiem',
  description: 'Guides for operating deterministic and replayable Requiem workloads.',
};

const docsLinks = [
  {
    href: '/library',
    title: 'Operator Library',
    description: 'Implementation guides and architecture context for deterministic operations.',
  },
  {
    href: '/features',
    title: 'Product Features',
    description: 'Understand the core guarantees, governance controls, and replay workflows.',
  },
  {
    href: '/support',
    title: 'Support Resources',
    description: 'Find incident, contact, and escalation paths for production usage.',
  },
  {
    href: '/status',
    title: 'System Status',
    description: 'Verify deployed versions and service health before operational changes.',
  },
];

export default function DocsPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Documentation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Run deterministic workflows with confidence.</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Requiem documentation is organized around operating truths: policy enforcement, replay evidence, tenant boundaries,
          and predictable incident response.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-4 pb-16 sm:px-6">
        {docsLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
          >
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>
    </MarketingShell>
  );
}
