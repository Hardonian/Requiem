'use client';

/**
 * Console Runs Page - Execution history with determinism proofs
 *
 * What: View all executed runs with their verification status.
 * Why: Every execution is provable and replayable for auditability.
 * What you can do: View run details, verify determinism, compare runs.
 *
 * API: GET /api/runs → { v:1, ok:true, data:[{run_id,tenant_id,status,created_at}], trace_id }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  HashDisplay,
  ErrorDisplay,
  VerificationBadge,
  RouteTruthStateCard,
  TruthActionButton,
} from '@/components/ui';
import { normalizeArray, normalizeEnvelope } from '@/lib/api-truth';

interface Run {
  run_id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  determinism_verified?: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ConsoleRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [verifyingRun, setVerifyingRun] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<
    Record<string, { status: 'verified' | 'failed'; message: string }>
  >({});
  const [routeState, setRouteState] = useState<
    'ready' | 'backend-missing' | 'backend-unreachable' | 'forbidden' | 'runtime-error'
  >('ready');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  // Track latest verification result row so we can scroll it into view
  const latestResultRef = useRef<HTMLTableRowElement | null>(null);
  const [latestVerifiedRun, setLatestVerifiedRun] = useState<string | null>(null);

  const fetchRuns = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/runs?limit=${pagination.pageSize}&offset=${(page - 1) * pagination.pageSize}`,
        );

        // Resolve route state from HTTP status first
        if (response.status === 403) {
          setRouteState('forbidden');
        } else if (response.status >= 500) {
          setRouteState('backend-unreachable');
        } else {
          setRouteState('ready');
        }

        const envelope = normalizeEnvelope<Run[]>(await response.json());

        if (envelope.ok) {
          const items = normalizeArray<Run>(envelope.data);
          setRuns(items);
          setPagination((prev) => ({
            ...prev,
            page,
            total: items.length,
            totalPages: Math.max(1, Math.ceil(items.length / prev.pageSize)),
          }));
        } else {
          // Refine route state from envelope error code
          if (envelope.error?.code === 'E_BACKEND_UNCONFIGURED') {
            setRouteState('backend-missing');
          } else if (response.status === 403) {
            setRouteState('forbidden');
          } else if (response.status >= 500) {
            setRouteState('backend-unreachable');
          } else {
            setRouteState('runtime-error');
          }
          setError({
            code: envelope.error?.code ?? 'E_FETCH_FAILED',
            message: envelope.error?.message ?? 'Failed to fetch runs',
            traceId: envelope.traceId,
          });
          // Reset runs so stale rows don't persist behind error UI
          setRuns([]);
        }
      } catch (err) {
        setRouteState('backend-unreachable');
        setError({
          code: 'E_NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network error occurred',
        });
        setRuns([]);
      } finally {
        setLoading(false);
      }
    },
    [pagination.pageSize],
  );

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Scroll the latest verification result row into view
  useEffect(() => {
    if (latestVerifiedRun && latestResultRef.current) {
      latestResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [latestVerifiedRun, verificationResults]);

  const handleVerify = useCallback(
    async (runId: string) => {
      // Prevent duplicate submit for the same run while one is pending
      if (verifyingRun === runId) return;

      setVerifyingRun(runId);
      setLatestVerifiedRun(runId);
      try {
        const response = await fetch(`/api/runs/${runId}/diff?with=${encodeURIComponent(runId)}`, {
          method: 'GET',
        });
        const data = await response.json();

        setVerificationResults((prev) => ({
          ...prev,
          [runId]: {
            status: data.ok ? 'verified' : 'failed',
            message: data.ok
              ? 'Determinism verified — self-diff is clean'
              : (data.error?.message ?? 'Verification failed'),
          },
        }));

        if (data.ok) {
          setRuns((prev) =>
            prev.map((run) => (run.run_id === runId ? { ...run, determinism_verified: true } : run)),
          );
        }
      } catch (err) {
        setVerificationResults((prev) => ({
          ...prev,
          [runId]: {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Verification request failed',
          },
        }));
      } finally {
        setVerifyingRun(null);
      }
    },
    [verifyingRun],
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ok':
      case 'completed':
      case 'success':
        return 'bg-success/10 text-success border border-success/20';
      case 'failed':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      case 'running':
        return 'bg-accent/10 text-accent border border-accent/20';
      case 'pending':
        return 'bg-warning/10 text-warning border border-warning/20';
      default:
        return 'bg-surface-elevated text-muted border border-border';
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchRuns(newPage);
    }
  };

  // Derive the effective "has data" state independently from error state
  const hasRuns = !loading && runs.length > 0;
  const isDegraded = routeState !== 'ready';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Runs"
        description="Execution history with determinism proofs. Verify runs via self-diff integrity checks."
      />

      {/* Route state degradation — shown only when backend is not responding correctly */}
      {isDegraded && (
        <div className="mb-6">
          <RouteTruthStateCard
            stateLabel={routeState}
            title={
              routeState === 'backend-missing'
                ? 'Backend is not configured'
                : routeState === 'backend-unreachable'
                  ? 'Backend appears unreachable'
                  : routeState === 'forbidden'
                    ? 'Forbidden for current actor'
                    : 'Runtime request failed'
            }
            detail={
              routeState === 'backend-missing'
                ? 'Runs route is runtime-backed but REQUIEM_API_URL is not set. No live data can be fetched.'
                : routeState === 'backend-unreachable'
                  ? 'Runs route received no valid response from the backend. Check process health and network reachability.'
                  : routeState === 'forbidden'
                    ? 'Auth succeeded but this actor/tenant is not authorized to read runs in this context.'
                    : 'The runs route returned an unexpected error. Inspect the error payload and trace ID below.'
            }
            nextStep={
              routeState === 'backend-missing'
                ? 'Set REQUIEM_API_URL and restart, then retry.'
                : routeState === 'backend-unreachable'
                  ? 'Check backend process and network, then retry.'
                  : routeState === 'forbidden'
                    ? 'Switch to an authorized actor or update policy bindings.'
                    : 'Review the error details below and retry once conditions are corrected.'
            }
            tone="warning"
          />
        </div>
      )}

      {/* Error detail — only shown when not also showing a route-state card for the same cause */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={() => fetchRuns(pagination.page)}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading runs..." />
      ) : !hasRuns ? (
        <EmptyState
          title={error ? 'Runs could not be loaded' : 'No runs found'}
          description={
            error
              ? 'Resolve the error above and retry to load execution history.'
              : 'Execute a plan to create your first run. Use: reach plan run --file <plan.yaml>'
          }
          action={
            error ? (
              <button
                type="button"
                onClick={() => fetchRuns(1)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                Retry
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th scope="col">Run ID</th>
                  <th scope="col">Tenant</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col" className="text-center">Verify</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const result = verificationResults[run.run_id];
                  const isLatestResult = run.run_id === latestVerifiedRun;
                  return (
                    <>
                      <tr key={run.run_id}>
                        <td>
                          <a
                            href={`/runs/${run.run_id}`}
                            className="text-sm font-mono text-accent hover:underline"
                          >
                            <HashDisplay hash={run.run_id} length={16} showCopy={false} />
                          </a>
                        </td>
                        <td className="text-sm text-muted font-mono">{run.tenant_id || '—'}</td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}
                          >
                            {run.status || 'unknown'}
                          </span>
                        </td>
                        <td className="text-sm text-muted">
                          {run.created_at ? run.created_at.substring(0, 19).replace('T', ' ') : '—'}
                        </td>
                        <td className="text-center">
                          {run.determinism_verified ? (
                            <span
                              className="inline-flex items-center text-success"
                              title="Determinism verified"
                              aria-label="Determinism verified"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </span>
                          ) : (
                            <TruthActionButton
                              label="Verify self-diff"
                              onClick={() => handleVerify(run.run_id)}
                              pending={verifyingRun === run.run_id}
                              semantics="runtime-backed"
                              disabled={isDegraded || verifyingRun === run.run_id}
                              disabledReason={
                                isDegraded
                                  ? 'Backend is degraded — verification cannot be trusted'
                                  : undefined
                              }
                            />
                          )}
                        </td>
                      </tr>
                      {result && (
                        <tr
                          key={`${run.run_id}-result`}
                          ref={isLatestResult ? latestResultRef : null}
                        >
                          <td colSpan={5} className="px-4 py-2 bg-surface-elevated">
                            <VerificationBadge
                              status={result.status}
                              message={`Run ${run.run_id.substring(0, 16)}…`}
                              details={result.message}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — only shown when there are actual rows */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total.toLocaleString()} run{pagination.total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="text-sm text-muted" aria-live="polite" aria-atomic="true">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
