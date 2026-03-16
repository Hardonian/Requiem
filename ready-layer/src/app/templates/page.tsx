import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Templates | Requiem',
  description: 'Pre-built agent templates and patterns for common AI governance use cases.',
};

const templates = [
  {
    name: 'Audit Evidence Capture',
    description: 'Capture and preserve complete audit trails for compliance.',
    tags: ['compliance', 'audit', 'evidence'],
  },
  {
    name: 'Drift Hunter',
    description: 'Detect and alert on model behavior drift in production.',
    tags: ['monitoring', 'drift', 'alerts'],
  },
  {
    name: 'Dry Run Simulation',
    description: 'Simulate agent behavior before production execution.',
    tags: ['testing', 'simulation', 'safety'],
  },
  {
    name: 'File Integrity Run',
    description: 'Verify file system integrity after agent operations.',
    tags: ['security', 'verification', 'files'],
  },
  {
    name: 'Replay First CI',
    description: 'Run agents with full replay capability in CI/CD.',
    tags: ['ci-cd', 'replay', 'testing'],
  },
  {
    name: 'Security Basics',
    description: 'Basic security checks for agent operations.',
    tags: ['security', 'compliance', 'checks'],
  },
  {
    name: 'Webhook Transcript Verify',
    description: 'Verify webhook payloads against agent transcripts.',
    tags: ['webhooks', 'verification', 'integration'],
  },
];

export default function TemplatesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Templates</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Pre-built agent templates.
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Common AI governance and automation patterns for production use.
          Run any template via the CLI using{' '}
          <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">reach plan run --file &lt;template&gt;.yaml</code>.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <article
              key={template.name}
              className="bg-surface rounded-xl p-6 shadow-sm border border-border"
            >
              <h3 className="text-base font-semibold text-foreground mb-2 font-display">
                {template.name}
              </h3>
              <p className="text-sm text-muted mb-4">{template.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-surface-elevated text-muted text-xs rounded border border-border font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Ready to run a template?</p>
            <p className="text-sm text-muted mt-1">
              Try the live demo or install the CLI to run templates against the full deterministic runtime.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/demo"
              className="inline-flex items-center px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Try demo
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center px-5 py-2.5 bg-surface-elevated border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors"
            >
              CLI docs
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
