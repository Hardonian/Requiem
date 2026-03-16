import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Enterprise | Requiem — Control Plane for AI Systems',
  description: 'Provable execution, enforced governance, and replayable outcomes for enterprise AI. SOC 2 controls, signed artifacts, and SLA-backed determinism.',
  openGraph: {
    title: 'Requiem Enterprise — Control Plane for AI Systems',
    description: 'Every AI decision provable. Every outcome replayable. Every policy enforced. SOC 2 ready.',
    url: 'https://requiem.hardonian.com/enterprise',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Requiem Enterprise — Control Plane for AI Systems',
    description: 'Deterministic AI execution with enforced governance and replayable outcomes.',
  },
};

const guarantees = [
  {
    title: 'Provable Execution',
    body: 'Every AI decision produces a cryptographic proof via BLAKE3 domain-separated hashing. Identical inputs produce identical result_digests across runs, workers, and time. Verified by 200× repeat gates in CI.',
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
    <MarketingShell>
      {/* Hero */}
      <section className="bg-foreground text-background py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-mono text-background/40 mb-4 tracking-wider uppercase">Control Plane for AI Systems</p>
          <h1 className="text-5xl font-bold mb-6 font-display">
            Every AI decision. Provable.
          </h1>
          <p className="text-xl text-background/60 max-w-3xl mx-auto mb-4">
            The only runtime where every execution produces a cryptographic proof,
            every outcome is replayable to the byte, and every policy violation
            is caught before it ships.
          </p>
          <p className="text-sm text-background/40 mb-8">
            Not a prompt router. Not a workflow engine. Not a Git wrapper. A control plane with invariants.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/enterprise/request-demo"
              className="px-8 py-3 bg-accent hover:brightness-110 text-white rounded-lg font-medium transition-all text-sm"
            >
              Request Demo
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 bg-background/10 hover:bg-background/20 text-background rounded-lg font-medium transition-all text-sm border border-background/20"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Three Guarantees */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center font-display">Three Guarantees</h2>
          <p className="text-muted text-center mb-12">Enforced in code, not implied in copy.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {guarantees.map((g) => (
              <div key={g.title} className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                <h3 className="text-lg font-bold text-foreground mb-3 font-display">{g.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Flow */}
      <section className="py-20 bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center font-display">Data Flow</h2>
          <p className="text-muted text-center mb-8">Request → Gate → Execution → Proof → Storage</p>
          <div className="bg-surface-elevated rounded-xl p-10 border border-border">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                { label: 'Request', className: 'bg-accent text-white' },
                { label: 'Policy Gate', className: 'bg-accent/80 text-white' },
                { label: 'Execution', className: 'bg-success text-foreground' },
                { label: 'Proof', className: 'bg-warning text-foreground' },
                { label: 'CAS Storage', className: 'bg-surface border border-border text-foreground' },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className={`${step.className} px-4 py-2 rounded-lg font-medium text-sm`}>
                    {step.label}
                  </span>
                  {i < arr.length - 1 && <span className="text-muted" aria-hidden="true">→</span>}
                </div>
              ))}
            </div>
            <p className="text-center text-muted text-sm mt-8">
              Every request flows through the policy gate. Every execution produces a proof.
              Every proof is stored in CAS. Nothing bypasses the invariants.
            </p>
          </div>
        </div>
      </section>

      {/* Why Enterprises Switch */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8 font-display">Why Enterprises Switch</h2>
          <div className="overflow-x-auto bg-surface rounded-xl border border-border shadow-sm">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Without Requiem</th>
                  <th>With Requiem</th>
                </tr>
              </thead>
              <tbody>
                {switchReasons.map((r) => (
                  <tr key={r.problem}>
                    <td className="font-medium">{r.problem}</td>
                    <td className="text-muted">{r.without}</td>
                    <td className="text-success font-medium">{r.with}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 font-display">Enterprise Capabilities</h2>
          <p className="text-muted mb-12">Unlocked with Enterprise tier. No code changes required.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enterpriseFeatures.map((f) => (
              <div key={f.title} className="bg-background p-6 rounded-xl shadow-sm border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-3 font-display">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8 font-display">Use Cases</h2>
          <div className="space-y-6">
            {useCases.map((uc) => (
              <div key={uc.title} className="border border-border rounded-xl p-6 bg-surface">
                <h3 className="font-semibold text-foreground mb-2 font-display">{uc.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{uc.scenario}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-foreground text-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4 font-display">
            Determinism is not a feature. It is the runtime.
          </h2>
          <p className="text-background/60 mb-8">
            Every claim on this page is enforced in code, verified in CI, and provable in production.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/enterprise/request-demo"
              className="inline-block px-8 py-3 bg-accent hover:brightness-110 text-white rounded-lg font-medium transition-all text-sm"
            >
              Schedule a Demo
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-8 py-3 bg-background/10 hover:bg-background/20 text-background rounded-lg font-medium transition-all text-sm border border-background/20"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
