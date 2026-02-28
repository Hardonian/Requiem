import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Enterprise Governance OS | Requiem',
  description: 'Enterprise governance for deterministic AI development: policy enforcement, replay-grade auditability, and multi-provider arbitration.',
  openGraph: {
    title: 'Requiem Enterprise Governance OS',
    description: 'Deterministic CI for AI agents with audit-grade replay, tenant isolation, and policy controls.',
    url: 'https://requiem.ai/enterprise',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Requiem Enterprise Governance OS',
    description: 'Deterministic CI for AI agents with policy and arbitration controls.',
  },
};

const sections = [
  {
    title: 'Enterprise Overview',
    body: 'Requiem Enterprise provides a governance operating system for AI delivery teams that need deterministic outcomes, explainable policy gates, and reproducible run evidence in every release cycle.',
  },
  {
    title: 'Security & Compliance',
    body: 'Audit-grade replay, signed artifacts, policy trace retention, and tenant-scoped controls support SOC 2, internal controls, and regulated deployment programs without changing developer ergonomics.',
  },
  {
    title: 'Architecture',
    body: 'Governance planes include Determinism Replay, DGL for divergence control, CPX for patch arbitration, SCCL for source coherence, Policy Engine rules, and evidence chain exports.',
  },
  {
    title: 'Deployment Options',
    body: 'Deploy in cloud-managed, on-prem, or hybrid mode with Git-native integration, private networking options, and isolated tenant boundaries for execution and evidence storage.',
  },
  {
    title: 'Policy Controls',
    body: 'Define controls for residency, provider routing, trust boundaries, and change-risk thresholds. Policies evaluate continuously and can block non-compliant patches before merge.',
  },
  {
    title: 'Integrations',
    body: 'Integrates with GitHub, GitLab, existing CI systems, artifact registries, and model providers through a provider SDK that preserves deterministic replay and governance metadata.',
  },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              Enterprise Governance OS
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Deterministic CI for AI agents with multi-provider arbitration, policy enforcement, and replay-grade auditability.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/enterprise/request-demo"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Request Demo
              </Link>
              <Link
                href="/docs"
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Read Documentation
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sections.map((section) => (
              <div key={section.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {section.title}
                </h3>
                <p className="text-gray-600">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to secure your AI infrastructure?
          </h2>
          <p className="text-gray-300 mb-8">
            Get a personalized demo of Requiem Enterprise and learn how we can help you achieve deterministic AI governance.
          </p>
          <Link
            href="/enterprise/request-demo"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Schedule a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
