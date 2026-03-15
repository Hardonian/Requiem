/**
 * Run Detail Page with Proof Panel
 *
 * What: Inspect a single execution run — fingerprints, determinism status, proof metadata.
 * Why: Every run produces a cryptographic proof that can be inspected and shared.
 * What you can do: View proof details, copy fingerprints, return to run list.
 */

import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Fingerprint, AlertCircle, Activity } from 'lucide-react';
import { getPredictions, getOutcomes, getSignals, getCases } from '@/lib/intelligence-store';
import { CopyButton } from '@/components/ui';

interface RunPageProps {
  params: Promise<{ runId: string }>;
}

async function fetchRunData(runId: string) {
  const apiUrl = process.env.REQUIEM_API_URL;

  if (!apiUrl) {
    // Backend not configured — return a degraded but honest state rather than crashing
    return {
      id: runId,
      shortId: runId.length > 8 ? runId.substring(0, 8) : runId,
      tenantId: null,
      toolName: null,
      status: 'unknown',
      inputFingerprint: null,
      outputFingerprint: null,
      replayVerified: false,
      replayMatchPercent: null,
      createdAt: null,
      degraded: true as const,
    };
  }

  try {
    const res = await fetch(`${apiUrl}/runs/${encodeURIComponent(runId)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      return {
        id: runId,
        shortId: runId.length > 8 ? runId.substring(0, 8) : runId,
        tenantId: null,
        toolName: null,
        status: 'error',
        inputFingerprint: null,
        outputFingerprint: null,
        replayVerified: false,
        replayMatchPercent: null,
        createdAt: null,
        degraded: true as const,
      };
    }
    const json = await res.json();
    const data = json.data ?? json;
    return {
      id: runId,
      shortId: runId.length > 8 ? runId.substring(0, 8) : runId,
      tenantId: data.tenant_id ?? null,
      toolName: data.tool_name ?? data.toolName ?? null,
      status: data.status ?? 'unknown',
      inputFingerprint: data.input_fingerprint ?? data.inputFingerprint ?? null,
      outputFingerprint: data.output_fingerprint ?? data.outputFingerprint ?? null,
      replayVerified: Boolean(data.replay_verified ?? data.replayVerified),
      replayMatchPercent: data.replay_match_percent ?? data.replayMatchPercent ?? null,
      createdAt: data.created_at ?? data.createdAt ?? null,
      degraded: false as const,
    };
  } catch {
    return {
      id: runId,
      shortId: runId.length > 8 ? runId.substring(0, 8) : runId,
      tenantId: null,
      toolName: null,
      status: 'error',
      inputFingerprint: null,
      outputFingerprint: null,
      replayVerified: false,
      replayMatchPercent: null,
      createdAt: null,
      degraded: true as const,
    };
  }
}

export default async function RunPage({ params }: RunPageProps) {
  const { runId } = await params;

  if (!runId || runId.trim() === '') {
    notFound();
  }

  const run = await fetchRunData(runId);

  if (!run) {
    notFound();
  }

  const tenantId = run.tenantId ?? 'unknown';
  const predictions = getPredictions(tenantId, runId);
  const outcomes = getOutcomes(tenantId, runId);
  const signals = getSignals(tenantId).slice(0, 5);
  const similarCases = getCases(tenantId).slice(0, 3);

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/console/runs" className="hover:text-foreground transition-colors">
            Runs
          </Link>
          <svg
            className="w-3.5 h-3.5 text-muted/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-mono text-foreground">{run.shortId}</span>
        </nav>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-display">Run Details</h1>
            <p className="text-sm text-muted mt-1 font-mono">{runId}</p>
          </div>
          {run.status && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                run.status === 'completed' || run.status === 'ok' || run.status === 'success'
                  ? 'bg-success/10 text-success border-success/20'
                  : run.status === 'failed' || run.status === 'error'
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : run.status === 'running'
                      ? 'bg-accent/10 text-accent border-accent/20'
                      : 'bg-surface-elevated text-muted border-border'
              }`}
            >
              {run.status}
            </span>
          )}
        </div>

        {/* Degraded state notice */}
        {run.degraded && (
          <div
            className="mb-6 p-4 rounded-xl bg-warning/5 border border-warning/20 flex items-start gap-3"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {process.env.REQUIEM_API_URL
                  ? 'Run data could not be fetched'
                  : 'Engine not connected'}
              </p>
              <p className="text-sm text-muted mt-1">
                {process.env.REQUIEM_API_URL
                  ? 'The backend returned an error for this run. Proof details are unavailable.'
                  : 'Set REQUIEM_API_URL to fetch live run data and proof details.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Proof Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                {run.replayVerified ? (
                  <CheckCircle className="w-5 h-5 text-success" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-muted" aria-hidden="true" />
                )}
                <h2 className="text-lg font-semibold text-foreground">Proof Panel</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-elevated rounded-lg p-4 border border-border">
                  <div className="text-xs text-muted font-medium uppercase tracking-wider mb-2">
                    Determinism
                  </div>
                  <div className="flex items-center gap-2">
                    {run.degraded ? (
                      <span className="text-sm text-muted">—</span>
                    ) : run.replayVerified ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-success" aria-hidden="true" />
                        <span className="text-sm font-semibold text-success">Verified</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted">Not yet verified</span>
                    )}
                  </div>
                </div>

                <div className="bg-surface-elevated rounded-lg p-4 border border-border">
                  <div className="text-xs text-muted font-medium uppercase tracking-wider mb-2">
                    Replay Match
                  </div>
                  {run.degraded || run.replayMatchPercent === null ? (
                    <span className="text-sm text-muted">—</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div
                        className="flex-1 bg-border rounded-full h-1.5"
                        role="progressbar"
                        aria-valuenow={run.replayMatchPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Replay match: ${run.replayMatchPercent}%`}
                      >
                        <div
                          className="bg-success h-1.5 rounded-full transition-all"
                          style={{ width: `${run.replayMatchPercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {run.replayMatchPercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fingerprints */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg border border-border">
                  <Fingerprint className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted font-medium uppercase tracking-wider mb-0.5">
                      Input Fingerprint
                    </div>
                    {run.inputFingerprint ? (
                      <code className="text-sm font-mono text-foreground break-all">
                        {run.inputFingerprint}
                      </code>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </div>
                  {run.inputFingerprint && (
                    <CopyButton text={run.inputFingerprint} label="input fingerprint" size="md" />
                  )}
                </div>

                <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg border border-border">
                  <Fingerprint className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted font-medium uppercase tracking-wider mb-0.5">
                      Output Fingerprint
                    </div>
                    {run.outputFingerprint ? (
                      <code className="text-sm font-mono text-foreground break-all">
                        {run.outputFingerprint}
                      </code>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </div>
                  {run.outputFingerprint && (
                    <CopyButton text={run.outputFingerprint} label="output fingerprint" size="md" />
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Actions</h3>
              <div className="flex items-center gap-3">
                <Link
                  href="/console/runs"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-surface-elevated border border-border rounded-lg hover:bg-surface text-foreground transition-colors"
                >
                  <Activity className="w-4 h-4" aria-hidden="true" />
                  Back to all runs
                </Link>
                <Link
                  href={`/app/replay`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-surface-elevated border border-border rounded-lg hover:bg-surface text-foreground transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                    />
                  </svg>
                  Open Replay Lab
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Predictions &amp; Outcomes
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-surface-elevated rounded-lg border border-border">
                  <div className="text-xs text-muted mb-1">Predictions</div>
                  <div className="font-semibold text-foreground">{predictions.length}</div>
                </div>
                <div className="p-3 bg-surface-elevated rounded-lg border border-border">
                  <div className="text-xs text-muted mb-1">Outcomes</div>
                  <div className="font-semibold text-foreground">{outcomes.length}</div>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Similar Cases</h3>
              {similarCases.length === 0 ? (
                <p className="text-sm text-muted">No case matches for this tenant.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {similarCases.map((item) => (
                    <li key={item.case_id} className="rounded-lg border border-border p-3">
                      <p className="font-medium text-foreground">{item.summary}</p>
                      <p className="text-xs text-muted mt-0.5 font-mono">{item.failing_command}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Risk &amp; Signals</h3>
              {signals.length === 0 ? (
                <p className="text-sm text-muted">No recent signals for this tenant.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {signals.map((item) => (
                    <li
                      key={item.signal_id}
                      className="flex justify-between items-center border-b border-border pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-foreground">{item.signal_type}</span>
                      <code className="text-xs text-muted font-mono">{item.severity}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Run Info</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Tool</dt>
                  <dd className="font-medium text-foreground font-mono text-right">
                    {run.toolName ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Status</dt>
                  <dd className="font-medium text-foreground capitalize">{run.status}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Tenant</dt>
                  <dd className="font-medium text-foreground font-mono text-right truncate">
                    {run.tenantId ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Created</dt>
                  <dd className="text-foreground">
                    {run.createdAt
                      ? new Date(run.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
