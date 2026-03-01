import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transparency | Requiem',
  description: 'What Requiem proves, what it enforces, and where it is honest about limitations.',
};

export default function TransparencyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Transparency</h1>
        <p className="text-gray-500 mb-8">
          What Requiem proves, what it enforces, and where it is honest about limitations.
        </p>

        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Is Provable</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5 shrink-0">&#x25A0;</span>
              <span><strong>Deterministic execution:</strong> Identical inputs produce identical result_digest values. Verified by 200x repeat gates in CI.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5 shrink-0">&#x25A0;</span>
              <span><strong>Policy enforcement:</strong> Every tool invocation passes through a deny-by-default gate. Four-layer defense enforced before execution.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5 shrink-0">&#x25A0;</span>
              <span><strong>Replay verification:</strong> Any execution can be replayed and verified against its original cryptographic proof.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5 shrink-0">&#x25A0;</span>
              <span><strong>Audit immutability:</strong> Append-only Merkle chain audit log with tamper-evident integrity checks.</span>
            </li>
          </ul>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Open Source Core</h2>
          <p className="text-gray-600 mb-4">
            The following components are open source under MIT license:
          </p>
          <ul className="space-y-2 text-gray-600">
            <li>Deterministic execution engine (C++ native runtime with BLAKE3 hashing)</li>
            <li>Content-addressable storage (CAS v2 with dual-hash verification)</li>
            <li>Policy gate (deny-by-default with RBAC, budgets, guardrails)</li>
            <li>Replay system (immutable ndjson logs with integrity verification)</li>
            <li>Formal verification specs (TLA+ for determinism, CAS, protocol, replay)</li>
          </ul>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Honest Security Posture</h2>
          <p className="text-gray-600 mb-4">
            Requiem publishes a theatre audit that explicitly distinguishes between
            implemented, partially implemented, and not-yet-implemented security controls.
            No feature is claimed without verification.
          </p>
          <p className="text-gray-600">
            Threat models, vulnerability disclosure process, and security gate configurations
            are documented and enforced in CI.
          </p>
        </section>

        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Is Not Yet Implemented</h2>
          <p className="text-gray-600 mb-4">
            In the spirit of honest engineering, these features are documented but not yet production-ready:
          </p>
          <ul className="space-y-2 text-gray-600">
            <li>Ed25519 signed result bundles (structure exists, signing is in progress)</li>
            <li>Seccomp-BPF sandbox enforcement (types defined, not wired)</li>
            <li>Production Stripe billing integration (SDK included, flows not active)</li>
          </ul>
          <p className="text-sm text-gray-400 mt-4">
            This list is updated with each release. No marketing claim exceeds implementation state.
          </p>
        </section>
      </div>
    </div>
  );
}
