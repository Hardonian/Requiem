import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Templates | ReadyLayer',
  description: 'Pre-built agent templates and patterns for common AI governance use cases.',
};

const templates = [
  {
    name: 'Audit Evidence Capture',
    description: 'Capture and preserve complete audit trails for compliance.',
    path: 'audit-evidence-capture',
    tags: ['compliance', 'audit', 'evidence'],
  },
  {
    name: 'Drift Hunter',
    description: 'Detect and alert on model behavior drift in production.',
    path: 'drift-hunter',
    tags: ['monitoring', 'drift', 'alerts'],
  },
  {
    name: 'Dry Run Simulation',
    description: 'Simulate agent behavior before production execution.',
    path: 'dry-run-simulation',
    tags: ['testing', 'simulation', 'safety'],
  },
  {
    name: 'File Integrity Run',
    description: 'Verify file system integrity after agent operations.',
    path: 'file-integrity-run',
    tags: ['security', 'verification', 'files'],
  },
  {
    name: 'Replay First CI',
    description: 'Run agents with full replay capability in CI/CD.',
    path: 'replay-first-ci',
    tags: ['ci-cd', 'replay', 'testing'],
  },
  {
    name: 'Security Basics',
    description: 'Basic security checks for agent operations.',
    path: 'security-basics',
    tags: ['security', 'compliance', 'checks'],
  },
  {
    name: 'Webhook Transcript Verify',
    description: 'Verify webhook payloads against agent transcripts.',
    path: 'webhook-transcript-verify',
    tags: ['webhooks', 'verification', 'integration'],
  },
];

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Templates</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Pre-built agent templates for common AI governance and automation patterns.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Link
              key={template.path}
              href={`/marketplace?template=${template.path}`}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {template.name}
              </h3>
              <p className="text-gray-600 mb-4">{template.description}</p>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
