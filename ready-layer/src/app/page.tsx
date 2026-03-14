// ready-layer/src/app/page.tsx
//
// Landing page — clear value prop, trust signals, quickstart

import type { ReactNode } from 'react';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

function TrustBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
      <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      {children}
    </span>
  );
}

function CliCommand({ command, output }: { command: string; output?: string }) {
  return (
    <div className="font-mono text-sm">
      <div className="flex items-center gap-2 text-success">
        <span className="text-muted select-none" aria-hidden="true">$</span>
        <span>{command}</span>
      </div>
      {output && (
        <div className="mt-1 text-muted pl-4 border-l-2 border-border">
          {output}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <MarketingShell>
      {/* HERO SECTION */}
      <section className="bg-foreground text-background py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2 mb-8" aria-label="Key properties">
              <TrustBadge>Deterministic</TrustBadge>
              <TrustBadge>Replay-Proven</TrustBadge>
              <TrustBadge>Capability-Enforced</TrustBadge>
              <TrustBadge>Budget-Guarded</TrustBadge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 font-display">
              Deterministic Agent Compute.
              <br />
              <span className="text-success">Verifiable by Design.</span>
            </h1>

            <p className="text-lg sm:text-xl text-background/60 max-w-2xl mx-auto mb-10 leading-relaxed">
              Run workflows with cryptographic receipts, capability enforcement, and
              replayable execution — not best-effort logs.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-success hover:brightness-110 text-foreground rounded-lg font-semibold transition-all text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run the 60-Second Demo
              </Link>
              <a
                href="https://github.com/reachhq/requiem"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-background/10 hover:bg-background/20 text-background rounded-lg font-medium transition-all text-sm border border-background/10"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
              <Link
                href="/features"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-background/10 hover:bg-background/20 text-background rounded-lg font-medium transition-all text-sm border border-background/10"
              >
                Explore Features
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-20 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center font-display">
            Built for teams who don&apos;t trust best-effort orchestration.
          </h2>
          <p className="text-muted text-center mb-10 text-sm">See what changes when execution is provable.</p>

          <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full" role="table">
              <thead>
                <tr className="bg-surface-elevated border-b border-border">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider w-1/2">
                    Instead of
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-success uppercase tracking-wider w-1/2">
                    You get
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { from: 'Logs', to: 'Verifiable Receipts' },
                  { from: 'RBAC', to: 'Cryptographic Capabilities' },
                  { from: 'Audit Tables', to: 'Hash-Chained Event Log' },
                  { from: 'Cost Tracking', to: 'Enforced Budget Gates' },
                  { from: 'Monitoring', to: 'Deterministic Replay' },
                ].map((row) => (
                  <tr key={row.from}>
                    <td className="px-6 py-3.5 text-sm text-muted">{row.from}</td>
                    <td className="px-6 py-3.5 text-sm font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {row.to}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* QUICKSTART CLI */}
      <section className="py-20 bg-foreground text-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-3 font-display">Install. Run. Prove.</h2>
              <p className="text-background/50 mb-6 text-sm leading-relaxed">
                Get verifiable execution in under 60 seconds. No configuration. No hidden steps.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/demo"
                  className="inline-flex items-center px-4 py-2 bg-success hover:brightness-110 text-foreground rounded-lg font-semibold transition-all text-sm"
                >
                  Try Live Demo
                </Link>
                <Link
                  href="/console"
                  className="inline-flex items-center px-4 py-2 bg-background/10 hover:bg-background/20 rounded-lg font-medium transition-all text-sm border border-background/10"
                >
                  Open Console
                </Link>
              </div>
            </div>

            <div className="bg-background/5 rounded-xl border border-background/10 p-5 font-mono text-sm overflow-hidden" role="img" aria-label="Terminal showing Requiem CLI commands">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-background/10">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" aria-hidden="true" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" aria-hidden="true" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" aria-hidden="true" />
                <span className="ml-2 text-background/30 text-xs">terminal</span>
              </div>
              <div className="space-y-3">
                <CliCommand command="requiem caps mint --name demo" />
                <CliCommand command="requiem policy add --cap demo" />
                <CliCommand
                  command="requiem plan run --file hello.yaml"
                  output="Receipt: 0xA39F...E284&#10;Replay Verified ✓"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE GUARANTEES */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-foreground text-center mb-12 font-display">Three Guarantees. Zero Compromise.</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Provable Execution',
                desc: 'BLAKE3 domain-separated hashing. Identical inputs produce identical result_digest values.',
                color: 'text-success bg-success/10',
                icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
              },
              {
                title: 'Enforced Governance',
                desc: 'Deny-by-default policy gate. Every invocation passes RBAC, budgets, and guardrails.',
                color: 'text-accent bg-accent/10',
                icon: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
              },
              {
                title: 'Replayable Outcomes',
                desc: 'Content-addressable storage. Any execution replayable and verifiable against its proof.',
                color: 'text-purple-500 bg-purple-500/10',
                icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182',
              },
            ].map((g) => (
              <div key={g.title} className="text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${g.color}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={g.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground mb-2 font-display">{g.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CREDIBILITY */}
      <section className="py-12 bg-surface-elevated border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-base font-semibold text-foreground mb-6 font-display">
            Reproducible. Auditable. Deterministic.
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted">
            {[
              'Apache-2.0 Licensed',
              '200+ Determinism Tests in CI',
              'BLAKE3 + SHA-256 Dual-Hash',
            ].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
