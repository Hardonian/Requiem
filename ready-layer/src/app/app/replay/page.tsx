'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { normalizeArray, normalizeEnvelope } from '@/lib/api-truth';

type Run = { run_id: string; status?: string; created_at?: string };
type VerifyResponse = { ok: boolean; verified: boolean; error?: string; engine_version?: string };

export default function ReplayPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [executionId, setExecutionId] = useState('');
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/runs?limit=5&offset=0', { cache: 'no-store' });
        const envelope = normalizeEnvelope<Run[]>(await response.json());
        if (!response.ok || !envelope.ok) {
          setError(envelope.error?.message ?? `Request failed (${response.status})`);
          return;
        }
        setRuns(normalizeArray<Run>(envelope.data));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load run list');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function verifyReplay() {
    if (!executionId.trim()) return;
    setVerifyResult('Verifying…');
    try {
      const response = await fetch(`/api/replay/verify?execution_id=${encodeURIComponent(executionId.trim())}`);
      const envelope = normalizeEnvelope<VerifyResponse>(await response.json());
      if (!response.ok || !envelope.ok || !envelope.data) {
        setVerifyResult(`Verification failed: ${envelope.error?.message ?? `HTTP ${response.status}`}`);
        return;
      }
      setVerifyResult(envelope.data.verified ? 'Verified' : `Mismatch${envelope.data.error ? `: ${envelope.data.error}` : ''}`);
    } catch (verifyError) {
      setVerifyResult(verifyError instanceof Error ? verifyError.message : 'Verification request failed');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Replay Verification</h1>
        <p className="text-sm text-muted mt-1">Shows real replay verification calls. No synthetic replay metrics are displayed.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Operator signals</p>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li>API reachable: {loading ? 'checking…' : error ? 'no' : 'yes'}</li>
          <li>Rendered runs: {loading ? '—' : runs.length}</li>
          <li>Tenant context: inherited from request headers</li>
        </ul>
      </div>

      {error && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning">Replay surface is degraded</p>
          <p className="text-muted mt-1">{error}</p>
        </div>
      )}

      {!error && !loading && runs.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No runs are currently available to replay.</div>
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
          <button onClick={verifyReplay} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white">Verify</button>
        </div>
        {verifyResult && <p className="text-sm text-muted">{verifyResult}</p>}
        <p className="text-xs text-muted">Need broader run exploration? Use <Link href="/console/runs" className="text-accent hover:underline">Console Runs</Link>.</p>
      </div>
    </div>
  );
}
