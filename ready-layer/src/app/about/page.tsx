import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'About | Requiem',
  description: 'What Requiem is, why it exists, and how it approaches deterministic and policy-enforced AI operations.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">About</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Requiem exists to make AI operations verifiable under real scrutiny.</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Requiem is a deterministic execution and governance layer for AI workflows. It is designed for teams that need evidence they can audit,
          replay, and defend during incident response, compliance review, and security assessment.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 sm:grid-cols-3 sm:px-6">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Determinism first</h2>
          <p className="mt-3 text-sm text-slate-600">
            Execution semantics are built for repeatability so operators can compare runs with confidence instead of relying on best-effort logs.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Policy as runtime control</h2>
          <p className="mt-3 text-sm text-slate-600">
            Capabilities, budgets, and route-level constraints are explicit and machine-checkable, with denial paths that stay visible to operators.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Evidence over claims</h2>
          <p className="mt-3 text-sm text-slate-600">
            Product surfaces prioritize what can be proven through route behavior, audit outputs, and replay checks rather than unverified promises.
          </p>
        </article>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Explore the system surfaces</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Start with the feature map and docs entry points, then use security and support routes for trust posture and operator escalation paths.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/features" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              View features
            </Link>
            <Link href="/docs" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Open docs
            </Link>
            <Link href="/security" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Review security
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
