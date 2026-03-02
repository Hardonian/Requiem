import type { Metadata } from 'next';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">
            Determinism has a price. It&apos;s less than you think.
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Every tier includes the full deterministic execution engine, policy enforcement,
            and replay verification. Higher tiers unlock scale, isolation, and compliance.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16 -mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col ${
                  tier.highlighted ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'
                }`}
              >
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    {tier.period && (
                      <span className="text-gray-500 ml-1">{tier.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{tier.description}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-600 mt-0.5 shrink-0">&#x25A0;</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.ctaHref}
                  className={`block text-center py-2.5 rounded-lg font-medium transition-colors ${
                    tier.highlighted
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
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
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Feature Layer Mapping</h2>
          <p className="text-gray-500 text-center mb-8">Every feature maps to one of four layers.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 text-gray-500 font-medium">Layer</th>
                  <th className="text-left py-3 pr-4 text-gray-500 font-medium">Description</th>
                  <th className="text-center py-3 pr-4 text-gray-500 font-medium">OSS</th>
                  <th className="text-center py-3 pr-4 text-gray-500 font-medium">Pro</th>
                  <th className="text-center py-3 text-gray-500 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium text-gray-900">Control</td>
                  <td className="py-3 pr-4 text-gray-500">Determinism, Replay, Provenance</td>
                  <td className="py-3 pr-4 text-center">✅</td>
                  <td className="py-3 pr-4 text-center">✅</td>
                  <td className="py-3 text-center">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium text-gray-900">Governance</td>
                  <td className="py-3 pr-4 text-gray-500">Policy Gate, RBAC, Budgets</td>
                  <td className="py-3 pr-4 text-center">✅</td>
                  <td className="py-3 pr-4 text-center">✅</td>
                  <td className="py-3 text-center">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium text-gray-900">Economic</td>
                  <td className="py-3 pr-4 text-gray-500">Metering, Quotas, Chargeback</td>
                  <td className="py-3 pr-4 text-center">—</td>
                  <td className="py-3 pr-4 text-center">✅</td>
                  <td className="py-3 text-center">✅</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-gray-900">Enterprise</td>
                  <td className="py-3 pr-4 text-gray-500">Compliance, Isolation, Support</td>
                  <td className="py-3 pr-4 text-center">—</td>
                  <td className="py-3 pr-4 text-center">—</td>
                  <td className="py-3 text-center">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Usage Primitives */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Usage Metering</h2>
          <p className="text-gray-500 mb-8">
            Three primitives. Predictable costs. No surprises.
          </p>
          <div className="space-y-4">
            {usagePrimitives.map((p) => (
              <div key={p.name} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{p.description}</p>
                  </div>
                  <span className="text-sm font-mono text-gray-600 bg-gray-50 px-3 py-1 rounded">
                    {p.included}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Why the investment pays off</h2>
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
