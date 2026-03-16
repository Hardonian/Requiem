// ready-layer/src/app/app/providers/page.tsx
//
// Foundational Models — Pro plan gated feature page.
// Renders a truthful unavailable state so the route does not 404
// when accessed directly (e.g. via deep link or future plan upgrade).

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Foundational Models',
  description: 'Model provider configuration and routing. Available on the Pro plan.',
  robots: { index: false, follow: false },
};

export default function ProvidersPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Foundational Models</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-surface-elevated border border-border text-muted mt-0.5">
            Pro
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <p className="text-sm text-foreground leading-relaxed">
          Foundational Models lets you register, configure, and route requests to model providers.
          Attach capability budgets, set latency targets, and define fallback chains — all enforced
          by the policy engine before any model call is dispatched.
        </p>

        <div className="rounded-lg bg-surface-elevated border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Capabilities included in this feature</p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Multi-provider routing with automatic fallback</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Per-provider capability and spend budgets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Model version pinning with determinism guarantees</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted mt-2 flex-shrink-0" aria-hidden="true" />
              <span>Provider health tracked in Observability dashboard</span>
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
