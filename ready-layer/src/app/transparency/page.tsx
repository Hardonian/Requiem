import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Transparency | Requiem',
  description: 'What Requiem proves, what it enforces, and where it is honest about limitations.',
};

export default function TransparencyPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Transparency</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          What Requiem proves, what it enforces, and where it is honest about limitations.
        </h1>
      </section>

      <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 space-y-6">
        <section className="rounded-xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 font-display">What Is Provable</h2>
          <ul className="space-y-3 text-muted">
            {[
              {
                title: 'Deterministic execution',
                body: 'Identical inputs produce identical result_digest values. Verified by 200x repeat gates in CI.',
              },
              {
                title: 'Policy enforcement',
                body: 'Every tool invocation passes through a deny-by-default gate. Four-layer defense enforced before execution.',
              },
              {
                title: 'Replay verification',
                body: 'Any execution can be replayed and verified against its original cryptographic proof.',
              },
              {
                title: 'Audit immutability',
                body: 'Append-only Merkle chain audit log with tamper-evident integrity checks.',
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <svg className="w-5 h-5 text-success mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong className="text-foreground">{item.title}:</strong> {item.body}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 font-display">Open Source Core</h2>
          <p className="text-muted mb-4">
            The following components are open source under Apache-2.0 license:
          </p>
          <ul className="space-y-2 text-muted">
            {[
              'Deterministic execution engine (C++ native runtime with BLAKE3 hashing)',
              'Content-addressable storage (CAS v2 with dual-hash verification)',
              'Policy gate (deny-by-default with RBAC, budgets, guardrails)',
              'Replay system (immutable ndjson logs with integrity verification)',
              'Formal verification specs (TLA+ for determinism, CAS, protocol, replay)',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-muted/40 mt-1.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 font-display">Honest Security Posture</h2>
          <p className="text-muted mb-4">
            Requiem publishes a theatre audit that explicitly distinguishes between
            implemented, partially implemented, and not-yet-implemented security controls.
            No feature is claimed without verification.
          </p>
          <p className="text-muted">
            Threat models, vulnerability disclosure process, and security gate configurations
            are documented and enforced in CI.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 font-display">What Is Not Yet Implemented</h2>
          <p className="text-muted mb-4">
            In the spirit of honest engineering, these features are documented but not yet production-ready:
          </p>
          <ul className="space-y-2 text-muted">
            {[
              'Ed25519 signed result bundles (structure exists, signing is in progress)',
              'Seccomp-BPF sandbox enforcement (types defined, not wired)',
              'Production Stripe billing integration (SDK included, flows not active)',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-warning mt-1.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted/60 mt-4">
            This list is updated with each release. No marketing claim exceeds implementation state.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
