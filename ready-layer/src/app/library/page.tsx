import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Library | ReadyLayer',
  description: 'Documentation, guides, and resources for ReadyLayer.',
};

const resources = [
  {
    title: 'Quick Start Guide',
    description: 'Get up and running with ReadyLayer in minutes.',
    href: '/docs/quick-start',
  },
  {
    title: 'Architecture Overview',
    description: 'Understand the ReadyLayer system design and components.',
    href: '/docs/architecture',
  },
  {
    title: 'API Reference',
    description: 'Complete API documentation for programmatic access.',
    href: '/docs/api',
  },
  {
    title: 'CLI Reference',
    description: 'Command-line interface documentation.',
    href: '/docs/cli',
  },
  {
    title: 'Policy Configuration',
    description: 'Learn how to configure governance policies.',
    href: '/docs/configuration',
  },
  {
    title: 'Provider Integration',
    description: 'Connect with different LLM providers.',
    href: '/docs/providers',
  },
  {
    title: 'Security Guide',
    description: 'Security best practices and configuration.',
    href: '/docs/security',
  },
  {
    title: 'Observability',
    description: 'Monitoring, logging, and tracing setup.',
    href: '/docs/observability',
  },
];

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Library</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Documentation, guides, and resources to help you get the most out of ReadyLayer.
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
