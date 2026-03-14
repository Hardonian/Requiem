import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Support | Requiem',
  description: 'Support channels, status visibility, and operator help for Requiem.',
};

const supportLinks = [
  {
    href: '/support/contact',
    title: 'Contact support',
    description: 'Reach the team for production incidents, onboarding help, or sales requests.',
  },
  {
    href: '/status',
    title: 'System status',
    description: 'Review deployment metadata and backend health before troubleshooting.',
  },
  {
    href: '/docs',
    title: 'Documentation',
    description: 'Runbooks and product guides for deterministic workflows.',
  },
  {
    href: '/changelog',
    title: 'Changelog',
    description: 'Track platform changes and release details impacting operation.',
  },
];

export default function SupportPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Support</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Operator support without guesswork.</h1>
        <p className="mt-4 text-slate-600">
          Use the paths below to report incidents, verify platform state, and unblock deterministic production workflows quickly.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-4 pb-16 sm:grid-cols-2 sm:px-6">
        {supportLinks.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>
    </MarketingShell>
  );
}
