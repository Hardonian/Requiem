'use client';

/**
 * Console Logs Page - Immutable event log with prev-hash chain verification
 *
 * What: View and search the immutable event log.
 * Why: Every event is cryptographically linked for tamper-evidence.
 * What you can do: Search events, view details, verify chain integrity.
 *
 * API: GET /api/logs → { v:1, kind:'logs.list', data:{ ok:true, data:[...entries], total:N }, error:null }
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  HashDisplay,
  JsonViewer,
  ErrorDisplay,
} from '@/components/ui';

interface LogEntry {
  seq: number;
  prev: string;
  ts_logical?: number;
  ts?: string;
  event_type: string;
  actor: string;
  data_hash: string;
  message?: string;
  payload?: unknown;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ConsoleLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const fetchLogs = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/logs?limit=${pagination.pageSize}&offset=${(page - 1) * pagination.pageSize}`,
        );
        const envelope = await response.json();

        // API returns: { v:1, kind:'logs.list', data:{ ok:true, data:[...], total:N }, error:null }
        const inner = envelope.data;
        if (inner?.ok) {
          const entries: LogEntry[] = Array.isArray(inner.data) ? inner.data : [];
          const sorted = entries.slice().sort((a, b) => b.seq - a.seq);
          setLogs(sorted);
          const total = inner.total ?? entries.length;
          setPagination((prev) => ({
            ...prev,
            page,
            total,
            totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
          }));
        } else {
          setError({
            code: envelope.error?.code ?? inner?.error?.code ?? 'E_FETCH_FAILED',
            message: envelope.error?.message ?? inner?.error?.message ?? 'Failed to fetch logs',
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
    },
    [pagination.pageSize],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(
    (log) =>
      !searchTerm ||
      log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchLogs(newPage);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Event Logs"
        description="Immutable event log with prev-hash chain verification. Every event is cryptographically linked to the previous for tamper-evidence."
      />

      {/* Search */}
      <div className="bg-surface rounded-xl border border-border p-4 mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by message, event type, or actor..."
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm placeholder:text-muted"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={() => fetchLogs(pagination.page)}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading event logs..." />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No logs found"
          description={
            searchTerm
              ? 'Try adjusting your search terms.'
              : 'The event log is empty. Events appear after executions run.'
          }
        />
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Event Type</th>
                  <th>Actor</th>
                  <th>Data Hash</th>
                  <th>Message</th>
                  <th className="text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <>
                    <tr
                      key={log.seq}
                      className="cursor-pointer"
                      onClick={() => setExpandedLog(expandedLog === log.seq ? null : log.seq)}
                    >
                      <td className="font-mono text-muted text-sm">
                        #{log.seq.toLocaleString()}
                      </td>
                      <td>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                          {log.event_type || '—'}
                        </span>
                      </td>
                      <td className="text-sm text-foreground">{log.actor || '—'}</td>
                      <td>
                        <HashDisplay hash={log.data_hash} length={12} />
                      </td>
                      <td className="text-sm text-muted max-w-xs truncate">
                        {log.message || '—'}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="text-muted hover:text-foreground transition-colors"
                          aria-label={expandedLog === log.seq ? 'Collapse' : 'Expand'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedLog(expandedLog === log.seq ? null : log.seq);
                          }}
                        >
                          <svg
                            className={`w-5 h-5 transform transition-transform ${
                              expandedLog === log.seq ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.seq && (
                      <tr key={`${log.seq}-expanded`} className="bg-surface-elevated">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-1">
                                  Previous Hash
                                </span>
                                <HashDisplay hash={log.prev} length={32} />
                              </div>
                              <div>
                                <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-1">
                                  Logical Time
                                </span>
                                <span className="text-foreground font-mono text-sm">
                                  {log.ts_logical ?? log.ts ?? '—'}
                                </span>
                              </div>
                            </div>
                            {log.payload != null && <JsonViewer data={log.payload} title="Event Payload" />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total.toLocaleString()} entries
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
