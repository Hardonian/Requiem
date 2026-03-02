// ready-layer/src/app/app/semantic-ledger/page.tsx
//
// Semantic Ledger UI — Visualize the Semantic State Machine primitive.
// Displays states, transitions, drift taxonomy, and integrity scores.
// INVARIANT: All data from /api/semantic-ledger. No direct engine calls.

"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";

// Types matching the SSM primitive
interface SemanticStateDescriptor {
  modelId: string;
  modelVersion?: string;
  promptTemplateId: string;
  promptTemplateVersion: string;
  policySnapshotId: string;
  contextSnapshotId: string;
  runtimeId: string;
  evalSnapshotId?: string;
  metadata?: Record<string, unknown>;
}

interface SemanticState {
  id: string;
  descriptor: SemanticStateDescriptor;
  createdAt: string;
  actor: string;
  labels?: Record<string, string>;
  integrityScore: number;
  evidenceRefs?: string[];
}

interface ChangeVector {
  path: string;
  from: unknown;
  to: unknown;
  significance: "critical" | "major" | "minor" | "cosmetic";
}

interface SemanticTransition {
  fromId?: string;
  toId: string;
  timestamp: string;
  reason: string;
  driftCategories: string[];
  changeVectors: ChangeVector[];
  integrityDelta: number;
  replayStatus?: "verified" | "failed" | "pending" | "not_applicable";
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingState() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-md mb-8" />
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="h-96 bg-slate-50 animate-pulse rounded-xl" />
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-red-900 mb-2">Failed to Load Semantic Ledger</h2>
            <p className="text-red-700 text-sm mb-4">{message}</p>
            <button
              onClick={retry}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">No Semantic States</h3>
      <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
        The Semantic State Machine is empty. Create your first state using the CLI to begin tracking AI execution lineage.
      </p>
      <div className="bg-slate-900 rounded-xl p-4 text-left inline-block">
        <code className="text-xs text-blue-400 font-mono">
          reach state genesis --descriptor descriptor.json
        </code>
      </div>
    </div>
  );
}

function IntegrityBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return "bg-green-100 text-green-700 border-green-200";
    if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getColor()}`}>
      {score}/100
    </span>
  );
}

function DriftTag({ category }: { category: string }) {
  const colors: Record<string, string> = {
    model_drift: "bg-purple-100 text-purple-700 border-purple-200",
    prompt_drift: "bg-blue-100 text-blue-700 border-blue-200",
    policy_drift: "bg-orange-100 text-orange-700 border-orange-200",
    context_drift: "bg-slate-100 text-slate-700 border-slate-200",
    eval_drift: "bg-pink-100 text-pink-700 border-pink-200",
    runtime_drift: "bg-gray-100 text-gray-700 border-gray-200",
    unknown_drift: "bg-gray-50 text-gray-600 border-gray-200",
  };

  const color = colors[category] || colors.unknown_drift;

  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${color}`}>
      {category.replace("_", " ")}
    </span>
  );
}

function StateCard({ state, onClick }: { state: SemanticState; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="font-mono text-xs text-slate-500 truncate max-w-[180px]">
          {state.id.substring(0, 16)}...
        </div>
        <IntegrityBadge score={state.integrityScore} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center text-sm">
          <span className="text-slate-400 w-16 text-[10px] uppercase tracking-wider">Model</span>
          <span className="text-slate-700 font-medium">{state.descriptor.modelId}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-slate-400 w-16 text-[10px] uppercase tracking-wider">Prompt</span>
          <span className="text-slate-700 text-xs truncate max-w-[140px]">
            {state.descriptor.promptTemplateId}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-slate-400 w-16 text-[10px] uppercase tracking-wider">Created</span>
          <span className="text-slate-500 text-xs">
            {new Date(state.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      {state.labels && Object.keys(state.labels).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
          {Object.entries(state.labels).map(([key, value]) => (
            <span
              key={key}
              className="px-1.5 py-0.5 bg-slate-50 text-slate-600 text-[9px] rounded border border-slate-100"
            >
              {key}: {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StateDetail({
  state,
  transitions,
  onClose,
}: {
  state: SemanticState;
  transitions: SemanticTransition[];
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">State Details</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{state.id}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Integrity Score */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Integrity</h4>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-700">{state.integrityScore}</span>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500"
                  style={{ width: `${state.integrityScore}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Computed from verifiable signals: parity, policy binding, context capture, eval attachment, replay verification, artifact signing
              </p>
            </div>
          </div>
        </div>

        {/* Descriptor */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Descriptor</h4>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex">
              <span className="w-32 text-slate-400">Model</span>
              <span className="text-slate-700 font-medium">
                {state.descriptor.modelId}@{state.descriptor.modelVersion || "latest"}
              </span>
            </div>
            <div className="flex">
              <span className="w-32 text-slate-400">Prompt Template</span>
              <span className="text-slate-700">
                {state.descriptor.promptTemplateId}@{state.descriptor.promptTemplateVersion}
              </span>
            </div>
            <div className="flex">
              <span className="w-32 text-slate-400">Policy Snapshot</span>
              <span className="font-mono text-xs text-slate-500">
                {state.descriptor.policySnapshotId.substring(0, 24)}...
              </span>
            </div>
            <div className="flex">
              <span className="w-32 text-slate-400">Context Snapshot</span>
              <span className="font-mono text-xs text-slate-500">
                {state.descriptor.contextSnapshotId.substring(0, 24)}...
              </span>
            </div>
            <div className="flex">
              <span className="w-32 text-slate-400">Runtime</span>
              <span className="text-slate-700">{state.descriptor.runtimeId}</span>
            </div>
            {state.descriptor.evalSnapshotId && (
              <div className="flex">
                <span className="w-32 text-slate-400">Eval Snapshot</span>
                <span className="font-mono text-xs text-slate-500">
                  {state.descriptor.evalSnapshotId.substring(0, 24)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Transitions */}
        {transitions.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Transitions ({transitions.length})
            </h4>
            <div className="space-y-2">
              {transitions.map((t, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-xs">
                      {new Date(t.timestamp).toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        t.integrityDelta >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {t.integrityDelta >= 0 ? "+" : ""}
                      {t.integrityDelta} integrity
                    </span>
                  </div>
                  <p className="text-slate-700 mb-2">{t.reason}</p>
                  {t.driftCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.driftCategories.map((cat) => (
                        <DriftTag key={cat} category={cat} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function SemanticLedgerContent() {
  const [states, setStates] = useState<SemanticState[]>([]);
  const [transitions, setTransitions] = useState<SemanticTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<SemanticState | null>(null);
  const [filter, setFilter] = useState({
    model: "",
    minScore: "",
  });

  // Load data from API
  useEffect(() => {
    async function loadData() {
      try {
        // In a real implementation, this would call /api/semantic-ledger
        // For now, we'll use empty data to show the empty state
        setStates([]);
        setTransitions([]);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStates = states.filter((s) => {
    if (filter.model && !s.descriptor.modelId.includes(filter.model)) return false;
    if (filter.minScore && s.integrityScore < parseInt(filter.minScore)) return false;
    return true;
  });

  const stats = {
    total: states.length,
    avgIntegrity: states.length
      ? Math.round(states.reduce((a, s) => a + s.integrityScore, 0) / states.length)
      : 0,
    highIntegrity: states.filter((s) => s.integrityScore >= 80).length,
    transitions: transitions.length,
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={() => window.location.reload()} />;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Semantic Ledger</h1>
          <p className="text-slate-500 mt-1">
            Verifiable, replayable, policy-bound semantic states for AI executions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center px-3 py-1 bg-purple-50 border border-purple-100 rounded-full text-[11px] font-bold text-purple-700 uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2" />
            SSM Active
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          { label: "Total States", value: stats.total.toString(), sub: "Semantic states" },
          { label: "Avg Integrity", value: stats.avgIntegrity.toString(), unit: "%", sub: "Across all states" },
          { label: "High Integrity", value: stats.highIntegrity.toString(), sub: "Score >= 80" },
          { label: "Transitions", value: stats.transitions.toString(), sub: "Recorded changes" },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              {m.label}
            </p>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-slate-900 tracking-tight">{m.value}</span>
              {m.unit && <span className="text-sm font-medium text-slate-400 ml-1">{m.unit}</span>}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">{m.sub}</p>
          </div>
        ))}
      </div>

      {states.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <EmptyState />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-8">
          {/* States List */}
          <div className="col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">States</h2>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Filter by model..."
                    value={filter.model}
                    onChange={(e) => setFilter({ ...filter, model: e.target.value })}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                  <select
                    value={filter.minScore}
                    onChange={(e) => setFilter({ ...filter, minScore: e.target.value })}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">Min Score</option>
                    <option value="80">80+</option>
                    <option value="60">60+</option>
                    <option value="40">40+</option>
                  </select>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {filteredStates.map((state) => (
                    <StateCard
                      key={state.id}
                      state={state}
                      onClick={() => setSelectedState(state)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div>
            {selectedState ? (
              <StateDetail
                state={selectedState}
                transitions={transitions.filter(
                  (t) => t.toId === selectedState.id || t.fromId === selectedState.id
                )}
                onClose={() => setSelectedState(null)}
              />
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 border-dashed p-8 text-center">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">Select a state to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documentation Link */}
      <div className="mt-10 p-6 bg-purple-50/50 rounded-2xl border border-purple-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-purple-900">Semantic State Machine</h3>
          <p className="text-xs text-purple-700 mt-1">
            Learn about the new primitive for AI execution governance.
          </p>
        </div>
        <Link
          href="/docs/reference/semantic-state-machine"
          className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-sm font-medium transition-colors"
        >
          Read Documentation
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SemanticLedgerPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SemanticLedgerContent />
    </Suspense>
  );
}
