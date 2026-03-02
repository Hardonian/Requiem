/**
 * Security Page - Marketing Route
 * 
 * Server Component Only - Zero Client JS
 * SEO optimized with structured data
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Cryptographic execution proofs, deterministic AI, and policy enforcement for enterprise security.',
  openGraph: {
    title: 'Security | Requiem',
    description: 'Enterprise-grade security with cryptographic proofs.',
  },
  alternates: {
    canonical: 'https://requiem.hardonian.com/security',
  },
};

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Security Through Determinism
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Every AI execution is provable, replayable, and policy-compliant. 
            Cryptographic proofs ensure integrity from input to output.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="Cryptographic Proofs"
              description="BLAKE3-based hashing creates unique fingerprints for every execution. Verify integrity at any point."
            />
            <FeatureCard
              title="Byte-Perfect Replay"
              description="Replay any execution with exact environmental conditions. Debug with confidence."
            />
            <FeatureCard
              title="Policy Enforcement"
              description="Deny-by-default governance. Every operation passes through configurable policy gates."
            />
          </div>
        </div>
      </section>

      {/* Technical Details */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Technical Security
          </h2>
          <div className="space-y-6">
            <SecurityItem
              title="Deterministic Execution"
              description="Same input always produces same output. No non-deterministic operations allowed in sandbox."
            />
            <SecurityItem
              title="Signed Artifacts"
              description="All AI outputs are signed with cryptographic hashes. Tamper-evident by design."
            />
            <SecurityItem
              title="Audit Logging"
              description="Complete execution history with cryptographic verification of log integrity."
            />
            <SecurityItem
              title="Provider Arbitration"
              description="Multi-provider routing with automatic failover and policy-based selection."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready for Provable AI?
          </h2>
          <p className="text-slate-300 mb-8">
            Deploy deterministic AI with cryptographic guarantees.
          </p>
          <Link
            href="/app/executions"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Building
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function SecurityItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-lg bg-slate-100">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
        ✓
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-slate-600">{description}</p>
      </div>
    </div>
  );
}
