import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Enterprise | Requiem — Provable AI Runtime',
  description: 'Provable execution, enforced governance, and replayable outcomes for enterprise AI. SOC 2 controls, signed artifacts, and SLA-backed determinism.',
  openGraph: {
    title: 'Requiem Enterprise — Provable AI Runtime',
    description: 'Every AI decision provable. Every outcome replayable. Every policy enforced. SOC 2 ready.',
    url: 'https://readylayer.com/enterprise',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Requiem Enterprise — Provable AI Runtime',
    description: 'Deterministic AI execution with enforced governance and replayable outcomes.',
  },
};

const guarantees = [
  {
    title: 'Provable Execution',
    body: 'Every AI decision produces a cryptographic proof via BLAKE3 domain-separated hashing. Identical inputs produce identical result_digests across runs, workers, and time. Verified by 200x repeat gates in CI.',
  },
  {
    title: 'Enforced Governance',
    body: 'Deny-by-default policy gate evaluates every tool invocation. Four-layer defense: RBAC capabilities, budget enforcement, content guardrails, and audit logging. No execution bypasses the gate.',
  },
  {
    title: 'Replayable Outcomes',
    body: 'Content-addressable storage with dual-hash verification (BLAKE3 + SHA-256). Any execution can be replayed and verified against its original proof. Divergence is detected, not hidden.',
  },
];

const enterpriseFeatures = [
  {
    title: 'SOC 2 Compliance Controls',
    body: 'Immutable Merkle chain audit log, signed artifact chain, and compliance-ready export. Evidence is generated during execution, not retroactively gathered.',
  },
  {
    title: 'Multi-Tenant Isolation',
    body: 'Tenant-scoped CAS, execution boundaries, and quota enforcement. Each tenant operates in cryptographic isolation with independent policy evaluation.',
  },
  {
    title: 'Deployment Flexibility',
    body: 'Cloud-managed, on-prem, or hybrid. Git-native integration, private networking, and isolated tenant boundaries for execution and evidence storage.',
  },
  {
    title: 'Advanced Policy Engine',
    body: 'DGL for divergence control, CPX for patch arbitration, SCCL for source coherence. Policies evaluate continuously and block non-compliant executions before they complete.',
  },
  {
    title: 'Signed Artifact Chain',
    body: 'Every execution produces a signed provenance bundle. Ed25519 signatures chain execution evidence into tamper-evident records.',
  },
  {
    title: 'Cluster Coordination',
    body: 'Version and protocol drift detection across cluster nodes. Incompatible workers are automatically quarantined to preserve determinism guarantees.',
  },
];

const switchReasons = [
  {
    problem: '"Did the AI do the same thing twice?"',
    without: 'Hope so. Check logs.',
    with: 'Prove it. result_digest match across runs.',
  },
  {
    problem: '"Can we audit what happened?"',
    without: 'Grep through logs. Reconstruct manually.',
    with: 'Immutable Merkle chain with replay proof.',
  },
  {
    problem: '"Is policy being enforced?"',
    without: 'Trust the middleware.',
    with: 'Deny-by-default gate. Every invocation. No bypass.',
  },
  {
    problem: '"Can we reproduce this for regulators?"',
    without: 'No.',
    with: 'Replayable to the byte with cryptographic evidence.',
  },
];

const useCases = [
  {
    title: 'Regulated AI in Financial Services',
    scenario: 'A trading desk deploys AI-assisted decision support. Regulators require proof that the AI produced the same recommendation given the same inputs. Requiem provides deterministic execution with replay verification and compliance-ready evidence export.',
  },
  {
    title: 'Healthcare AI Governance',
    scenario: 'A health system uses AI for clinical decision support. Every recommendation must be auditable, reproducible, and compliant with organizational policy. Requiem enforces governance at the execution layer with immutable audit trails.',
  },
  {
    title: 'Multi-Tenant AI Platform',
    scenario: 'A SaaS company runs AI workloads for multiple enterprise customers. Each customer requires isolated execution, independent policy enforcement, and tenant-scoped audit logs. Requiem provides cryptographic tenant isolation with per-tenant CAS.',
  },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-mono text-gray-400 mb-4 tracking-wider">PROVABLE AI RUNTIME</p>
            <h1 className="text-5xl font-bold mb-6">
              Every AI decision. Provable.
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
              The only runtime where every execution produces a cryptographic proof,
              every outcome is replayable to the byte, and every policy violation
              is caught before it ships.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Not a prompt router. Not a workflow engine. Not a Git wrapper.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/enterprise/request-demo"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Request Demo
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Three Guarantees */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Three Guarantees</h2>
          <p className="text-gray-500 text-center mb-12">Enforced in code, not implied in copy.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {guarantees.map((g) => (
              <div key={g.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{g.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Enterprises Switch */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Why Enterprises Switch</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 text-gray-500 font-medium">Problem</th>
                  <th className="text-left py-3 pr-4 text-gray-500 font-medium">Without Requiem</th>
                  <th className="text-left py-3 text-gray-500 font-medium">With Requiem</th>
                </tr>
              </thead>
              <tbody>
                {switchReasons.map((r) => (
                  <tr key={r.problem} className="border-b">
                    <td className="py-3 pr-4 font-medium text-gray-900">{r.problem}</td>
                    <td className="py-3 pr-4 text-gray-500">{r.without}</td>
                    <td className="py-3 text-gray-900">{r.with}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Enterprise Capabilities</h2>
          <p className="text-gray-500 mb-12">Unlocked with Enterprise tier. No code changes required.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {enterpriseFeatures.map((f) => (
              <div key={f.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Use Cases</h2>
          <div className="space-y-6">
            {useCases.map((uc) => (
              <div key={uc.title} className="border border-gray-100 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{uc.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{uc.scenario}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Determinism is not a feature. It is the runtime.
          </h2>
          <p className="text-gray-400 mb-8">
            Every claim on this page is enforced in code, verified in CI, and provable in production.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/enterprise/request-demo"
              className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Schedule a Demo
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
