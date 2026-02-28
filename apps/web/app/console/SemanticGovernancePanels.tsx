'use client';

import Link from 'next/link';

type PanelMode = 'ledger' | 'transition' | 'policy' | 'migration';

const stateRows = [
  { id: 'sem_a19f', model: 'gpt-4.1', policy: 'policy_4d9a', integrity: 96, drift: 'ModelDrift' },
  { id: 'sem_a2bf', model: 'gpt-4.1', policy: 'policy_4d9a', integrity: 92, drift: 'None' },
  { id: 'sem_b11c', model: 'gpt-4.2', policy: 'policy_51de', integrity: 84, drift: 'PolicyDrift' },
];

export function SemanticGovernancePanel({ mode }: { mode: PanelMode }) {
  if (mode === 'ledger') {
    return (
      <section className="rounded-xl border border-[#2d3442] bg-[#1c1f27] p-6">
        <h1 className="text-xl font-semibold text-white">Semantic Ledger</h1>
        <p className="mt-2 text-sm text-[#9da6b9]">Track governed semantic states and filter by drift and integrity band.</p>
        {stateRows.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-[#2d3442] p-4 text-sm text-[#9da6b9]">No semantic states captured yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[#9da6b9]"><tr><th>ID</th><th>Model</th><th>Policy</th><th>Integrity</th><th>Drift</th></tr></thead>
              <tbody>
                {stateRows.map((row) => (
                  <tr key={row.id} className="border-t border-[#2d3442] text-white">
                    <td className="py-2">{row.id}</td><td>{row.model}</td><td>{row.policy}</td><td>{row.integrity}</td><td>{row.drift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  if (mode === 'transition') {
    return (
      <section className="rounded-xl border border-[#2d3442] bg-[#1c1f27] p-6">
        <h1 className="text-xl font-semibold text-white">Transition Viewer</h1>
        <p className="mt-2 text-sm text-[#9da6b9]">Inspect state-to-state meaning transitions with drift and integrity breakdown.</p>
        <div className="mt-6 space-y-3 text-sm text-white">
          <p>From: <span className="font-mono">sem_a2bf</span> → To: <span className="font-mono">sem_b11c</span></p>
          <p>Drift: ModelDrift, PolicyDrift</p>
          <p>Integrity: 84 (replay verified, policy bound, eval pending refresh)</p>
          <div className="flex gap-4 text-[#60a5fa]">
            <Link href="/console/governance/policy-snapshots">Policy snapshot</Link>
            <Link href="/console/evaluation">Evaluation snapshot</Link>
          </div>
        </div>
      </section>
    );
  }

  if (mode === 'policy') {
    return (
      <section className="rounded-xl border border-[#2d3442] bg-[#1c1f27] p-6">
        <h1 className="text-xl font-semibold text-white">Policy Snapshots</h1>
        <p className="mt-2 text-sm text-[#9da6b9]">Contract snapshots bound to semantic states and effective windows.</p>
        <ul className="mt-6 space-y-2 text-sm text-white">
          <li>policy_4d9a — policies/main.rego — effective 2026-02-01</li>
          <li>policy_51de — policies/main.rego@rev2 — effective 2026-02-24</li>
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#2d3442] bg-[#1c1f27] p-6">
      <h1 className="text-xl font-semibold text-white">Model Migration Simulator</h1>
      <p className="mt-2 text-sm text-[#9da6b9]">Preview governance impact before upgrading models.</p>
      <div className="mt-6 grid gap-4 text-sm text-white md:grid-cols-3">
        <div className="rounded-lg border border-[#2d3442] p-4"><p className="text-[#9da6b9]">Out of policy</p><p className="text-lg font-semibold">0</p></div>
        <div className="rounded-lg border border-[#2d3442] p-4"><p className="text-[#9da6b9]">Needs re-eval</p><p className="text-lg font-semibold">1</p></div>
        <div className="rounded-lg border border-[#2d3442] p-4"><p className="text-[#9da6b9]">Replay invalid</p><p className="text-lg font-semibold">0</p></div>
      </div>
    </section>
  );
}
