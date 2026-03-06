import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Library | ReadyLayer',
  description: 'Documentation, guides, and resources for ReadyLayer.',
};

const resources = [
  {
    title: 'Quick Start Guide',
    description: 'Start with operator-oriented docs and first-run links.',
    href: '/docs',
  },
  {
    title: 'Architecture Overview',
    description: 'Understand the ReadyLayer system design and components.',
    href: '/console/architecture',
  },
  {
    title: 'API Surface',
    description: 'Inspect the generated OpenAPI route contract.',
    href: '/api/openapi.json',
  },
  {
    title: 'CLI Operations',
    description: 'Run and verify workloads from the console entrypoint.',
    href: '/console',
  },
  {
    title: 'Policy Configuration',
    description: 'Configure governance policies and guardrails.',
    href: '/console/policies',
  },
  {
    title: 'Runtime Status',
    description: 'Check deployment health and runtime diagnostics.',
    href: '/status',
  },
  {
    title: 'Security Posture',
    description: 'Review implemented controls and disclosure guidance.',
    href: '/security',
  },
  {
    title: 'Support and Escalation',
    description: 'Contact support and review the service status feed.',
    href: '/support',
  },
];

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Library</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Documentation, guides, and operational resources for ReadyLayer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <Link
              key={resource.href}
              href={resource.href}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {resource.title}
              </h3>
              <p className="text-gray-600">{resource.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
