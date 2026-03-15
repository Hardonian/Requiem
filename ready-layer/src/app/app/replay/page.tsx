'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { normalizeArray, normalizeEnvelope } from '@/lib/api-truth';
import { classifyApiFailure } from '@/lib/route-truth';
import { RouteTruthStateCard, TruthActionButton } from '@/components/ui';

type Run = { run_id: string; status?: string; created_at?: string };
type VerifyResponse = { ok: boolean; verified: boolean; error?: string; engine_version?: string };

export default function ReplayPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number; code?: string } | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [executionId, setExecutionId] = useState('');
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifyPending, setVerifyPending] = useState(false);

  async function loadRuns() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/runs?limit=5&offset=0', { cache: 'no-store' });
      const envelope = normalizeEnvelope<Run[]>(await response.json());
      if (!response.ok || !envelope.ok) {
        setError({
          message: envelope.error?.message ?? `Request failed (${response.status})`,
          status: response.status,
          code: envelope.error?.code,
        });
        return;
      }
      setRuns(normalizeArray<Run>(envelope.data));
    } catch (fetchError) {
      setError({ message: fetchError instanceof Error ? fetchError.message : 'Failed to load run list', status: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  async function verifyReplay() {
    if (!executionId.trim()) return;
    setVerifyPending(true);
    setVerifyResult('Verifying runtime replay evidence…');
    try {
      const response = await fetch(`/api/replay/verify?execution_id=${encodeURIComponent(executionId.trim())}`);
      const envelope = normalizeEnvelope<VerifyResponse>(await response.json());
      if (!response.ok || !envelope.ok || !envelope.data) {
        const state = classifyApiFailure({ status: response.status, code: envelope.error?.code, message: envelope.error?.message });
        setVerifyResult(`Verification unavailable (${state.kind}): ${state.detail}`);
        return;
      }
      setVerifyResult(envelope.data.verified ? 'Verified against runtime evidence.' : `Mismatch${envelope.data.error ? `: ${envelope.data.error}` : ''}`);
    } catch (verifyError) {
      setVerifyResult(verifyError instanceof Error ? verifyError.message : 'Verification request failed');
    } finally {
      setVerifyPending(false);
    }
  }

  const failure = error ? classifyApiFailure({ status: error.status, code: error.code, message: error.message }) : null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Replay Verification</h1>
        <p className="text-sm text-muted mt-1">Verify deterministic execution. Replay claims are only confirmed against runtime API evidence.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Operator signals</p>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li>Runs API: {loading ? 'checking…' : error ? 'failed' : 'reachable'}</li>
          <li>Rendered runs: {loading ? '—' : runs.length}</li>
          <li>Tenant context: inherited from request headers</li>
        </ul>
      </div>

      {failure && (
        <RouteTruthStateCard
          tone={failure.kind === 'forbidden' ? 'critical' : 'warning'}
          stateLabel={failure.kind}
          title={failure.title}
          detail={`${failure.detail} Raw error: ${error?.message}`}
          nextStep={failure.nextStep}
          actions={
            <TruthActionButton
              label="Retry runs query"
              semantics="runtime-backed"
              onClick={() => {
                void loadRuns();
              }}
            />
          }
        />
      )}

      {!error && !loading && runs.length === 0 && (
        <RouteTruthStateCard
          stateLabel="no-data"
          title="No runs returned"
          detail="Backend endpoint responded successfully, but there are no runs available in current tenant/context."
          nextStep="Create or ingest at least one run, then retry."
          tone="neutral"
        />
      )}

      {!error && runs.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="text-left p-3">Run ID</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{run.run_id}</td>
                  <td className="p-3">{run.status ?? 'unknown'}</td>
                  <td className="p-3">{run.created_at ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Verify a specific execution</p>
        <div className="flex gap-2">
          <input
            value={executionId}
            onChange={(event) => setExecutionId(event.target.value)}
            placeholder="execution_id"
            className="flex-1 rounded border border-border bg-surface-elevated px-3 py-2 text-sm"
          />
          <TruthActionButton
            label="Verify"
            onClick={() => {
              void verifyReplay();
            }}
            pending={verifyPending}
            disabled={!executionId.trim()}
            disabledReason={!executionId.trim() ? 'execution_id is required' : undefined}
            semantics="runtime-backed"
          />
        </div>
        {verifyResult && <p className="text-sm text-muted">{verifyResult}</p>}
        <p className="text-xs text-muted">Need broader run exploration? Use <Link href="/console/runs" className="text-accent hover:underline">Console Runs</Link>.</p>
      </div>
    </div>
  );
}
