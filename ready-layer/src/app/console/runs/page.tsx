'use client';

/**
 * Console Runs Page - Execution history with determinism proofs
 * 
 * What: View all executed runs with their verification status.
 * Why: Every execution is provable and replayable for auditability.
 * What you can do: View run details, verify determinism, compare runs.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  PageHeader, 
  LoadingState, 
  EmptyState,
  HashDisplay,
  ErrorDisplay,
  VerificationBadge 
} from '@/components/ui';

interface Run {
  id: string;
  status: string;
  fingerprint: string;
  createdAt: string;
  determinism_verified?: boolean;
  receipt_hash?: string;
  event_count?: number;
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
  const [verificationResults, setVerificationResults] = useState<Record<string, { status: 'verified' | 'failed'; message: string }>>({});
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  const fetchRuns = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/runs?limit=${pagination.pageSize}&offset=${(page - 1) * pagination.pageSize}`);
      const data = await response.json();
      
      if (data.ok) {
        setRuns(data.runs || []);
        setPagination(prev => ({
          ...prev,
          page,
          total: data.total || 0,
          totalPages: Math.ceil((data.total || 0) / pagination.pageSize),
        }));
      } else {
        setError({
          code: data.error?.code || 'E_FETCH_FAILED',
          message: data.error?.message || 'Failed to fetch runs',
        });
      }
    } catch (err) {
      setError({
        code: 'E_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleVerify = useCallback(async (runId: string) => {
    setVerifyingRun(runId);
    try {
      const response = await fetch(`/api/runs/${runId}/verify`, { method: 'POST' });
      const data = await response.json();
      
      setVerificationResults(prev => ({
        ...prev,
        [runId]: {
          status: data.verified ? 'verified' : 'failed',
          message: data.message || (data.verified ? 'Determinism verified' : 'Verification failed'),
        }
      }));

      // Refresh the run data to update verified status
      if (data.verified) {
        setRuns(prev => prev.map(run => 
          run.id === runId ? { ...run, determinism_verified: true } : run
        ));
      }
    } catch (err) {
      setVerificationResults(prev => ({
        ...prev,
        [runId]: {
          status: 'failed',
          message: err instanceof Error ? err.message : 'Verification request failed',
        }
      }));
    } finally {
      setVerifyingRun(null);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
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
        description="Execution history with determinism proofs. Every run generates a cryptographic fingerprint for verification and replay."
      />

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
          description="Execute a plan to create your first run."
        />
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Run ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fingerprint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Events
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Verify
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a 
                        href={`/runs/${run.id}`}
                        className="text-sm font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <HashDisplay hash={run.id} length={16} showCopy={false} />
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                        {run.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <HashDisplay hash={run.fingerprint} length={16} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {run.event_count?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {run.createdAt?.substring(0, 19).replace('T', ' ') || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {run.determinism_verified ? (
                        <span className="inline-flex items-center text-green-600 dark:text-green-400" title="Verified">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVerify(run.id)}
                          disabled={verifyingRun === run.id}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          type="button"
                        >
                          {verifyingRun === run.id ? (
                            <>
                              <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Verifying...
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Verification Results */}
          {Object.entries(verificationResults).length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Verification Results</h3>
              {Object.entries(verificationResults).map(([runId, result]) => (
                <VerificationBadge
                  key={runId}
                  status={result.status}
                  message={`Run ${runId.substring(0, 16)}...`}
                  details={result.message}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total.toLocaleString()} runs
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
