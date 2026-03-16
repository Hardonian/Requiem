// ready-layer/src/app/app/signatures/page.tsx
//
// Artifact Signing — Pro plan gated feature page.
// Renders a truthful unavailable state so the route does not 404
// when accessed directly (e.g. via deep link or future plan upgrade).

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artifact Signing',
  description: 'Cryptographic signing for execution artifacts. Available on the Pro plan.',
  robots: { index: false, follow: false },
};

export default function SignaturesPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Artifact Signing</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-surface-elevated border border-border text-muted mt-0.5">
            Pro
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <p className="text-sm text-foreground leading-relaxed">
          Artifact Signing provides cryptographic attestation for execution receipts, plans, and
          policy documents. Each artifact is signed with a tenant-scoped key, producing a verifiable
          chain of custody from execution to storage.
        </p>

        <div className="rounded-lg bg-surface-elevated border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Capabilities included in this feature</p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Per-artifact ECDSA or Ed25519 signatures</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Key rotation with grace-period verification</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Signature status visible in the Audit Ledger</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>CLI verification via <code className="font-mono text-xs bg-background px-1 py-0.5 rounded">requiem verify --sig</code></span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <svg className="w-4 h-4 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <p className="text-sm text-muted">
            This feature is not available on your current plan. Contact your administrator to
            upgrade to the Pro plan.
          </p>
        </div>
      </div>
    </div>
  );
}
