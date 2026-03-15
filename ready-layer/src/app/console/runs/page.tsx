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

import { useState, useEffect, useCallback } from 'react';
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

  const fetchRuns = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/runs?limit=${pagination.pageSize}&offset=${(page - 1) * pagination.pageSize}`,
        );
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
            totalPages: Math.max(1, Math.ceil(items.length / pagination.pageSize)),
          }));
        } else {
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
        }
      } catch (err) {
        setRouteState('backend-unreachable');
        setError({
          code: 'E_NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network error occurred',
        });
      } finally {
        setLoading(false);
      }
    },
    [pagination.pageSize],
  );

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleVerify = useCallback(async (runId: string) => {
    setVerifyingRun(runId);
    try {
      const response = await fetch(`/api/runs/${runId}/diff?with=${encodeURIComponent(runId)}`, { method: 'GET' });
      const data = await response.json();

      setVerificationResults((prev) => ({
        ...prev,
        [runId]: {
          status: data.ok ? 'verified' : 'failed',
          message: data.ok ? 'Determinism verified' : (data.error?.message ?? 'Verification failed'),
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
  }, []);

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Runs"
        description="Execution history with explicit runtime action semantics. Verify runs via API-backed self-diff checks only."
      />

      {routeState !== 'ready' && (
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
                ? 'Runs route is runtime-backed but backend wiring is absent, so no truthful runtime data can be fetched.'
                : routeState === 'backend-unreachable'
                  ? 'Runs route expected a backend response but did not receive one. This is not a no-data state.'
                  : routeState === 'forbidden'
                    ? 'Auth succeeded but current actor/tenant is not allowed to read this route in current context.'
                    : 'Runs route returned an error state that is neither empty-data nor explicit auth denial.'
            }
            nextStep={
              routeState === 'backend-missing'
                ? 'Configure REQUIEM_API_URL and retry to restore runtime-backed behavior.'
                : routeState === 'backend-unreachable'
                  ? 'Check backend process/network health, then retry this runtime fetch.'
                  : routeState === 'forbidden'
                    ? 'Switch to an authorized actor/tenant or update policy bindings.'
                    : 'Inspect trace/error payload and retry once runtime conditions are corrected.'
            }
            tone="warning"
          />
        </div>
      )}

      {/* Error */}
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
      ) : runs.length === 0 ? (
        <EmptyState
          title="No runs found"
          description="Execute a plan to create your first run. Use: reach plan run --file <plan.yaml>"
        />
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-center">Verify</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
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
                      <td className="text-sm text-muted font-mono">
                        {run.tenant_id || '—'}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}
                        >
                          {run.status || 'unknown'}
                        </span>
                      </td>
                      <td className="text-sm text-muted">
                        {run.created_at
                          ? run.created_at.substring(0, 19).replace('T', ' ')
                          : '—'}
                      </td>
                      <td className="text-center">
                        {run.determinism_verified ? (
                          <span
                            className="inline-flex items-center text-success"
                            title="Verified"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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
                            disabled={routeState !== 'ready'}
                            disabledReason={
                              routeState === 'ready'
                                ? undefined
                                : 'Runtime backend state is degraded; verification cannot be trusted'
                            }
                          />
                        )}
                      </td>
                    </tr>
                    {verificationResults[run.run_id] && (
                      <tr key={`${run.run_id}-result`}>
                        <td colSpan={5} className="px-4 py-2 bg-surface-elevated">
                          <VerificationBadge
                            status={verificationResults[run.run_id].status}
                            message={`Run ${run.run_id.substring(0, 16)}...`}
                            details={verificationResults[run.run_id].message}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total.toLocaleString()} runs
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                Previous
              </button>
              <span className="text-sm text-muted">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
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
