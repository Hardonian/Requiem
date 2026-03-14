import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Security | Requiem',
  description: 'Security posture for deterministic execution, replay evidence, and policy enforcement in Requiem.',
  openGraph: {
    title: 'Security | Requiem',
    description: 'Deterministic execution with cryptographic evidence and explicit policy controls.',
  },
  alternates: {
    canonical: '/security',
  },
};

const controls = [
  {
    title: 'Deterministic execution core',
    description: 'Execution paths are constrained so identical inputs converge on identical result digests.',
  },
  {
    title: 'Replay verification',
    description: 'Captured artifacts can be replayed and compared against original proofs to detect divergence.',
  },
  {
    title: 'Deny-by-default policy gate',
    description: 'Tool usage, budgets, and permissions are evaluated before execution proceeds.',
  },
  {
    title: 'Tamper-evident evidence chain',
    description: 'Artifacts and logs are hashed so post-hoc mutation is visible during verification.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Trust & Security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Security built around verifiable behavior.</h1>
        <p className="mt-4 text-slate-600">
          Requiem security is anchored in deterministic behavior, explicit policy enforcement, and machine-verifiable evidence.
          We avoid implied guarantees and surface degraded states directly in runtime outputs.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-4 pb-10 sm:grid-cols-2 sm:px-6">
        {controls.map((control) => (
          <article key={control.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">{control.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{control.description}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Need a deeper review?</h2>
          <p className="mt-2 text-slate-600">
            For architecture and operational details, review the transparency and support surfaces or request a guided walkthrough.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/transparency" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Transparency
            </Link>
            <Link href="/support/contact" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Contact support
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
