import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Pricing | Requiem',
  description: 'Control Plane for AI Systems pricing: OSS, Pro, and Enterprise tiers.',
};

const tiers = [
  {
    name: 'OSS',
    price: 'Free',
    period: 'forever',
    description: 'Deterministic execution with full policy enforcement.',
    features: [
      'Deterministic execution engine',
      'CAS with dual-hash verification',
      'Policy gate (deny-by-default)',
      'Replay verification',
      'CLI + Dashboard',
      '1,000 execution credits / month',
      '1 GB replay storage',
      '10,000 policy events tracked',
      'Community support',
    ],
    cta: 'Get Started',
    ctaHref: '/docs',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/ month',
    description: 'Multi-tenant isolation and higher limits for growing teams.',
    features: [
      'Everything in OSS',
      '50,000 execution credits / month',
      '50 GB replay storage',
      '500,000 policy events tracked',
      'Multi-tenant isolation',
      'Priority support',
      'Cost accounting and chargeback',
      'Adversarial safety monitoring',
    ],
    cta: 'Start Trial',
    ctaHref: '/enterprise/request-demo',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'SOC 2 controls, signed artifacts, and SLA-backed support.',
    features: [
      'Everything in Pro',
      'Unlimited execution credits',
      'Unlimited replay storage',
      'Unlimited policy events',
      'SOC 2 compliance controls',
      'Signed artifact chain',
      'Cluster coordination',
      'Drift detection',
      'SLA-backed support',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
    ctaHref: '/support/contact',
    highlighted: false,
  },
];

const usagePrimitives = [
  {
    name: 'Execution Credits',
    description: 'Each tool invocation through the policy gate consumes one credit.',
    included: '1,000 / month (OSS)',
  },
  {
    name: 'Replay Storage',
    description: 'Immutable execution records stored for replay verification.',
    included: '1 GB (OSS)',
  },
  {
    name: 'Policy Events',
    description: 'Every policy gate evaluation is tracked and auditable.',
    included: '10,000 / month (OSS)',
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="bg-foreground text-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4 font-display">
            Determinism has a price. It&apos;s less than you think.
          </h1>
          <p className="text-lg text-background/60 max-w-2xl mx-auto">
            Every tier includes the full deterministic execution engine, policy enforcement,
            and replay verification. Higher tiers unlock scale, isolation, and compliance.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16 bg-surface -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-background rounded-xl shadow-sm border flex flex-col p-6 ${
                  tier.highlighted ? 'border-accent ring-2 ring-accent/20' : 'border-border'
                }`}
              >
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-foreground font-display">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                    {tier.period && (
                      <span className="text-muted ml-1">{tier.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-2">{tier.description}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
                      <svg className="w-4 h-4 text-success mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.ctaHref}
                  className={`block text-center py-2.5 rounded-lg font-medium transition-colors text-sm ${
                    tier.highlighted
                      ? 'bg-accent hover:brightness-110 text-white'
                      : 'bg-surface-elevated hover:bg-border text-foreground border border-border'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Layer Mapping */}
      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center font-display">Feature Layer Mapping</h2>
          <p className="text-muted text-center mb-8">Every feature maps to one of four layers.</p>
          <div className="overflow-x-auto bg-surface rounded-xl border border-border shadow-sm">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Description</th>
                  <th className="text-center">OSS</th>
                  <th className="text-center">Pro</th>
                  <th className="text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Control</td>
                  <td className="text-muted">Determinism, Replay, Provenance</td>
                  <td className="text-center text-success">✓</td>
                  <td className="text-center text-success">✓</td>
                  <td className="text-center text-success">✓</td>
                </tr>
                <tr>
                  <td className="font-medium">Governance</td>
                  <td className="text-muted">Policy Gate, RBAC, Budgets</td>
                  <td className="text-center text-success">✓</td>
                  <td className="text-center text-success">✓</td>
                  <td className="text-center text-success">✓</td>
                </tr>
                <tr>
                  <td className="font-medium">Economic</td>
                  <td className="text-muted">Metering, Quotas, Chargeback</td>
                  <td className="text-center text-muted">—</td>
                  <td className="text-center text-success">✓</td>
                  <td className="text-center text-success">✓</td>
                </tr>
                <tr>
                  <td className="font-medium">Enterprise</td>
                  <td className="text-muted">Compliance, Isolation, Support</td>
                  <td className="text-center text-muted">—</td>
                  <td className="text-center text-muted">—</td>
                  <td className="text-center text-success">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Usage Primitives */}
      <section className="py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 font-display">Usage Metering</h2>
          <p className="text-muted mb-8">
            Three primitives. Predictable costs. No surprises.
          </p>
          <div className="space-y-4">
            {usagePrimitives.map((p) => (
              <div key={p.name} className="border border-border rounded-xl p-4 bg-background flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-sm text-muted mt-1">{p.description}</p>
                </div>
                <span className="text-sm font-mono text-muted bg-surface-elevated px-3 py-1 rounded border border-border whitespace-nowrap shrink-0">
                  {p.included}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8 font-display">Why the investment pays off</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Reduced production risk',
                body: 'Every AI decision is deterministic and verifiable. No more "it worked differently in staging."',
              },
              {
                title: 'Audit-ready from day one',
                body: 'Immutable Merkle chain audit log with compliance export. No retroactive evidence gathering.',
              },
              {
                title: 'Governance certainty',
                body: 'Deny-by-default policy gate on every execution. Policy is enforced, not hoped for.',
              },
              {
                title: 'Reproducible AI decisions',
                body: 'Full execution replay with identical outputs. Debug production issues with certainty.',
              },
            ].map((item) => (
              <div key={item.title} className="border border-border rounded-xl p-5 bg-surface">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted mt-1">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
