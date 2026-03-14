import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Features | Requiem',
  description: 'Core Requiem capabilities for deterministic execution, governance, and replay verification.',
};

const featureGroups = [
  {
    title: 'Deterministic runtime',
    points: [
      'Stable execution semantics for reproducible outcomes.',
      'Cryptographic digests for result and artifact verification.',
      'Replay workflows to compare original and rerun outputs.',
    ],
  },
  {
    title: 'Policy and governance',
    points: [
      'Deny-by-default gates for capabilities, budgets, and route-level controls.',
      'Machine-visible rejection paths with explicit trace identifiers.',
      'Tenant-aware enforcement to prevent boundary bleed and metadata leaks.',
    ],
  },
  {
    title: 'Operational surfaces',
    points: [
      'Status, support, and changelog routes for operator visibility.',
      'Dashboard routes for execution, policy, registry, and drift analysis.',
      'Evidence-oriented static pages that align product claims with runtime behavior.',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Features</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">A control plane built for verification-first AI operations.</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Requiem emphasizes deterministic behavior and audit-grade evidence over best-effort orchestration.
          These capabilities are designed to hold up during security, compliance, and incident review.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 sm:grid-cols-3 sm:px-6">
        {featureGroups.map((group) => (
          <article key={group.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {group.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-1 text-emerald-600">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Next steps</h2>
          <p className="mt-2 text-slate-600">Explore runtime behavior in the live demo, then review pricing and support paths for rollout planning.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/demo" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Run live demo
            </Link>
            <Link href="/pricing" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
