'use client';

/**
 * Simulate — run what-if experiments against your agents.
 * Purpose: Compare model/prompt/provider variants side-by-side.
 * Primary action: Start simulation.
 */

import { useState, useEffect } from 'react';

interface Scenario {
  id: string; name: string; variants: ScenarioVariant[];
  base_run_id: string | null; created_at: string;
}
interface ScenarioVariant {
  id: string; label: string; model?: string; provider?: string;
  prompt_override?: string; temperature?: number;
  disable_tools?: string[]; inject_latency_ms?: number;
}
interface ScenarioRun {
  id: string; status: string; recommendation: string | null;
  results: VariantResult[]; created_at: string; finished_at: string | null;
}
interface VariantResult {
  variant_id: string; variant_label: string; status: string;
  latency_ms: number; pass_rate: number; cost_usd: number; error?: string;
}

const PRESETS: Record<string, { label: string; description: string; defaults: Partial<ScenarioVariant>[] }> = {
  model_ab: {
    label: 'Model A/B',
    description: 'Compare two model variants with same prompt.',
    defaults: [
      { id: 'v1', label: 'Current model', model: 'gpt-4o' },
      { id: 'v2', label: 'Alternative model', model: 'claude-3-5-sonnet' },
    ],
  },
  latency_test: {
    label: 'Latency injection',
    description: 'Test agent behavior under simulated network delay.',
    defaults: [
      { id: 'v1', label: 'Baseline', inject_latency_ms: 0 },
      { id: 'v2', label: '500ms latency', inject_latency_ms: 500 },
      { id: 'v3', label: '2000ms latency', inject_latency_ms: 2000 },
    ],
  },
  tool_outage: {
    label: 'Tool outage',
    description: 'Simulate a tool being unavailable.',
    defaults: [
      { id: 'v1', label: 'All tools', disable_tools: [] },
      { id: 'v2', label: 'No search tool', disable_tools: ['search'] },
    ],
  },
};

function VerdictBadge({ status }: { status: string }) {
  const color = status === 'passed' ? 'text-green-400 bg-green-500/10' : status === 'failed' ? 'text-red-400 bg-red-500/10' : 'text-gray-400 bg-gray-500/10';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>;
}

export default function SimulatePage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeRun, setActiveRun] = useState<ScenarioRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState('model_ab');
  const [name, setName] = useState('');
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/v1/scenarios').then((r) => r.json()).then((d) => {
      setScenarios(d.scenarios ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { if (polling) clearInterval(polling); };
  }, []);

  async function startSimulation() {
    if (!name.trim()) return;
    setRunning(true);
    const p = PRESETS[preset];
    const variants = p.defaults.map((v) => ({
      id: v.id ?? `v${Math.random().toString(36).slice(2, 6)}`,
      label: v.label ?? 'Variant',
      ...v,
    })) as ScenarioVariant[];

    // Create scenario
    const createRes = await fetch('/api/v1/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, variants, compare_metrics: ['pass_rate', 'latency', 'cost'] }),
    });
    if (!createRes.ok) { setRunning(false); return; }
    const { scenario } = await createRes.json() as { scenario: Scenario };
    setScenarios((prev) => [scenario, ...prev]);

    // Trigger run
    const runRes = await fetch(`/api/v1/scenarios/${scenario.id}/run`, { method: 'POST' });
    if (!runRes.ok) { setRunning(false); return; }
    const { scenario_run } = await runRes.json() as { scenario_run: ScenarioRun };
    setActiveRun(scenario_run);

    // Poll for completion
    const interval = setInterval(async () => {
      const pollRes = await fetch(`/api/v1/reports/${scenario_run.id}`);
      if (pollRes.ok) {
        const data = await pollRes.json() as ScenarioRun;
        setActiveRun(data);
        if (data.status !== 'running') {
          clearInterval(interval);
          setPolling(null);
          setRunning(false);
        }
      }
    }, 2000);
    setPolling(interval);
  }

  return (
    <div className="min-h-screen bg-background py-8 px-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Simulate</h1>
          <p className="text-sm text-gray-400 mt-1">Run what-if experiments before shipping to production.</p>
        </div>

        {/* New simulation panel */}
        <div className="p-6 rounded-2xl border border-border bg-surface mb-8">
          <h2 className="text-base font-semibold text-white mb-4">New simulation</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Simulation name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder="Model comparison Q1" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Preset</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => setPreset(key)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                      preset === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-gray-400 hover:text-white'
                    }`}>
                    <span className="block font-semibold">{p.label}</span>
                    <span className="block text-gray-500 leading-snug mt-0.5">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Variant preview */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">{PRESETS[preset].defaults.length} variants</p>
            <div className="flex gap-2">
              {PRESETS[preset].defaults.map((v) => (
                <div key={v.id} className="flex-1 p-2 rounded-lg border border-border bg-background/50">
                  <p className="text-xs font-medium text-white">{v.label}</p>
                  {v.model && <p className="text-xs text-gray-500">{v.model}</p>}
                  {v.inject_latency_ms !== undefined && <p className="text-xs text-gray-500">{v.inject_latency_ms}ms delay</p>}
                  {v.disable_tools?.length ? <p className="text-xs text-gray-500">No: {v.disable_tools.join(', ')}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <button onClick={startSimulation} disabled={running || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {running ? (
              <><span className="animate-spin material-symbols-outlined text-[16px]">sync</span>Running…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">play_arrow</span>Run simulation</>
            )}
          </button>
        </div>

        {/* Active run results */}
        {activeRun && (
          <div className="p-6 rounded-2xl border border-border bg-surface mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Results</h2>
              <VerdictBadge status={activeRun.status} />
            </div>

            {activeRun.status === 'running' ? (
              <div className="text-sm text-gray-400 flex items-center gap-2 py-4">
                <span className="animate-spin material-symbols-outlined text-[18px]">sync</span>
                Running variants…
              </div>
            ) : (
              <>
                {activeRun.recommendation && (
                  <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/20 text-sm text-gray-300">
                    {activeRun.recommendation}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs text-gray-400 py-2 pr-4">Variant</th>
                        <th className="text-right text-xs text-gray-400 py-2 px-4">Status</th>
                        <th className="text-right text-xs text-gray-400 py-2 px-4">Pass rate</th>
                        <th className="text-right text-xs text-gray-400 py-2 px-4">Latency</th>
                        <th className="text-right text-xs text-gray-400 py-2 pl-4">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRun.results.map((r, idx) => {
                        const isBest = idx === 0 && r.status === 'passed'; // Assumption: sorted by ROI/best
                        return (
                          <tr key={r.variant_id} className="border-b border-border/50 last:border-0 relative">
                            <td className="py-2 pr-4 text-white font-medium flex items-center gap-2">
                              {r.variant_label}
                              {isBest && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                                  Best Variant
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right"><VerdictBadge status={r.status} /></td>
                            <td className="py-2 px-4 text-right text-gray-300">{(r.pass_rate * 100).toFixed(0)}%</td>
                            <td className="py-2 px-4 text-right text-gray-300">{r.latency_ms}ms</td>
                            <td className="py-2 pl-4 text-right text-gray-300">${r.cost_usd.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Share: <a href={`/reports/${activeRun.id}`} className="text-accent underline">View full report</a>
                </div>
              </>
            )}
          </div>
        )}

        {/* Past simulations */}
        {scenarios.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Past simulations</h2>
            <div className="flex flex-col gap-2">
              {scenarios.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50">
                  <span className="text-sm text-white">{s.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{s.variants.length} variants</span>
                    <button onClick={async () => {
                      setRunning(true);
                      const res = await fetch(`/api/v1/scenarios/${s.id}/run`, { method: 'POST' });
                      if (res.ok) {
                        const { scenario_run } = await res.json() as { scenario_run: ScenarioRun };
                        setActiveRun(scenario_run);
                      }
                      setRunning(false);
                    }} className="px-2 py-1 text-xs border border-border rounded text-gray-400 hover:text-white">
                      Re-run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && scenarios.length === 0 && !activeRun && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Run your first simulation above to compare variants.
          </div>
        )}
      </div>
    </div>
  );
}
