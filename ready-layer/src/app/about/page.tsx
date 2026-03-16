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
        <p className="text-sm font-medium uppercase tracking-wide text-muted">About</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Requiem exists to make AI operations verifiable under real scrutiny.
        </h1>
        <p className="mt-4 max-w-3xl text-muted">
          Requiem is a deterministic execution and governance layer for AI workflows. It is designed for teams that need evidence they can audit,
          replay, and defend during incident response, compliance review, and security assessment.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 sm:grid-cols-3 sm:px-6">
        {[
          {
            title: 'Determinism first',
            body: 'Execution semantics are built for repeatability so operators can compare runs with confidence instead of relying on best-effort logs.',
          },
          {
            title: 'Policy as runtime control',
            body: 'Capabilities, budgets, and route-level constraints are explicit and machine-checkable, with denial paths that stay visible to operators.',
          },
          {
            title: 'Evidence over claims',
            body: 'Product surfaces prioritize what can be proven through route behavior, audit outputs, and replay checks rather than unverified promises.',
          },
        ].map((item) => (
          <article key={item.title} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold text-foreground font-display">{item.title}</h2>
            <p className="mt-3 text-sm text-muted">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-xl font-semibold text-foreground font-display">Explore the system surfaces</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Start with the feature map and docs entry points, then use security and support routes for trust posture and operator escalation paths.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/features"
              className="inline-flex items-center px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              View features
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center px-5 py-2.5 bg-surface-elevated border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors"
            >
              Open docs
            </Link>
            <Link
              href="/security"
              className="inline-flex items-center px-5 py-2.5 bg-surface-elevated border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors"
            >
              Review security
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
