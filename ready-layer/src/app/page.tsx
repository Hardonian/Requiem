// ready-layer/src/app/page.tsx
//
// Root landing page — category definition for the control plane.
//
// CATEGORY DEFINITION:
// Requiem is a CONTROL PLANE for AI systems.
// It enforces invariants: deterministic replay, policy boundaries, provenance fingerprinting.
// Governance compute is foundational. Economic units are explicit.
// Replay + policy + economic layer = new class.
//
// This is NOT:
// - A Git project manager
// - A wrapper
// - An agent runner
// - An orchestration dashboard
//
// This IS:
// - A control plane with invariants
// - Deterministic replay semantics
// - Policy enforcement boundaries
// - Provenance fingerprinting
// - Economic compute units
// - Observability spine

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gray-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-mono text-gray-400 mb-4 tracking-wider">CONTROL PLANE FOR AI SYSTEMS</p>
            <h1 className="text-5xl font-bold mb-6 tracking-tight">
              Determinism is not a feature.
              <br />
              <span className="text-blue-400">It is the invariant.</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Requiem enforces execution invariants that other systems leave to chance.
              Every decision is provable. Every outcome is replayable. Every policy is enforced.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/app/executions"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Go to Console
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

      {/* What is a Control Plane */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Not a wrapper. Not a router. A control plane.
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3">What it enforces</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">◆</span>
                  <span>Deterministic replay semantics — identical inputs produce identical outputs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">◆</span>
                  <span>Policy enforcement boundaries — deny-by-default on every invocation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">◆</span>
                  <span>Provenance fingerprinting — every execution has a cryptographic proof</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">◆</span>
                  <span>Economic compute units — explicit metering, not hidden costs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">◆</span>
                  <span>Observability spine — complete trace from request to proof</span>
                </li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3">What it is NOT</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✕</span>
                  <span>A Git project manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✕</span>
                  <span>A wrapper around existing LLMs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✕</span>
                  <span>An agent runner</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✕</span>
                  <span>An orchestration dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✕</span>
                  <span>Convenience tooling</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Four Layers */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Four Layers. Zero Ambiguity.</h2>
          <p className="text-gray-500 text-center mb-12">Every feature maps to one of these layers.</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Control', desc: 'Deterministic execution, replay verification, provenance' },
              { name: 'Governance', desc: 'Policy gate, RBAC, budgets, guardrails' },
              { name: 'Economic', desc: 'Compute units, metering, chargeback, quotas' },
              { name: 'Observability', desc: 'Traces, metrics, audit logs, drift detection' },
            ].map((layer) => (
              <div key={layer.name} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{layer.name}</h3>
                <p className="text-sm text-gray-600">{layer.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Determinism Matters */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Governance-first architecture
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Execution Invariants',
                body: 'BLAKE3 domain-separated hashing with 200× repeat verification. Identical inputs produce identical result_digest across runs, workers, and time.',
              },
              {
                title: 'Policy Boundaries',
                body: 'Deny-by-default gate. Every tool invocation passes through RBAC, budget enforcement, content guardrails, and audit logging.',
              },
              {
                title: 'Replay Verification',
                body: 'Content-addressable storage with dual-hash verification (BLAKE3 + SHA-256). Any execution replayable and verifiable against its original proof.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Build infrastructure. Not demos.
          </h2>
          <p className="text-gray-400 mb-8">
            This is a control plane for operators who need provable AI systems.
            Not a toy. Not a wrapper. Infrastructure.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/app/executions"
              className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Enter Console
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
