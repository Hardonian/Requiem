'use client';

/**
 * Console Snapshots Page - State snapshot management
 * 
 * What: Create and restore state snapshots.
 * Why: Snapshots enable rollback, migration, and disaster recovery.
 * What you can do: View snapshots, restore state, verify integrity.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  HashDisplay,
  ErrorDisplay,
  VerificationBadge,
  RouteMaturityNote,
} from '@/components/ui';
import { getRouteMaturity, maturityNoteTone } from '@/lib/route-maturity';

interface Snapshot {
  id: string;
  name: string;
  createdAt: string;
  size: number;
  checksum: string;
  gated: boolean;
  description?: string;
}

export default function ConsoleSnapshotsPage() {
  const routeMaturity = getRouteMaturity('/console/snapshots');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/snapshots');
      const data = await response.json();
      
      if (data.ok) {
        setSnapshots(data.snapshots || []);
      } else {
        setError({
          code: data.error?.code || 'E_FETCH_FAILED',
          message: data.error?.message || 'Failed to fetch snapshots',
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
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleRestore = useCallback(async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to restore snapshot "${name}"?\n\nThis will replace the current state.`)) return;
    
    setRestoringId(id);
    setRestoreResult(null);
    
    try {
      const response = await fetch(`/api/snapshots?id=${id}`, { method: 'POST' });
      const data = await response.json();
      
      setRestoreResult({
        id,
        success: data.ok,
        message: data.ok 
          ? 'Snapshot restored successfully' 
          : (data.error?.message || 'Failed to restore snapshot'),
      });
      
      if (data.ok) {
        // Refresh to get updated state
        setTimeout(() => fetchSnapshots(), 1000);
      }
    } catch (err) {
      setRestoreResult({
        id,
        success: false,
        message: err instanceof Error ? err.message : 'Restore request failed',
      });
    } finally {
      setRestoringId(null);
    }
  }, [fetchSnapshots]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Snapshots"
        description="State snapshots for rollback, migration, and disaster recovery. Each snapshot is checksummed for integrity verification."
      />


      <RouteMaturityNote maturity={maturityNoteTone(routeMaturity.maturity)} title="Maturity: demo-backed route">
        {routeMaturity.degradedBehavior}
      </RouteMaturityNote>

      {/* Error */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchSnapshots}
          />
        </div>
      )}

      {/* Restore Result */}
      {restoreResult && (
        <div className="mb-6">
          <VerificationBadge
            status={restoreResult.success ? 'verified' : 'failed'}
            message={restoreResult.success ? 'Restore Complete' : 'Restore Failed'}
            details={restoreResult.message}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading snapshots..." />
      ) : snapshots.length === 0 ? (
        <EmptyState
          title="No snapshots found"
          description="No snapshots were returned. This is expected in local/demo mode unless a backend implementation is attached."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Checksum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Gated
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {snapshots.map((snap) => (
                <tr key={snap.id} className="hover:bg-gray-50 hover:bg-surface-elevated">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-foreground">
                    <HashDisplay hash={snap.id} length={16} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {snap.name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <HashDisplay hash={snap.checksum} length={16} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted">
                    {formatSize(snap.size || 0)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {snap.gated ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Gated
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                        Open
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted">
                    {snap.createdAt?.substring(0, 10) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRestore(snap.id, snap.name)}
                      disabled={restoringId === snap.id}
                      className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                      type="button"
                    >
                      {restoringId === snap.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {!loading && snapshots.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Total: {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
          </span>
          <span>
            Total size: {formatSize(snapshots.reduce((acc, s) => acc + (s.size || 0), 0))}
          </span>
        </div>
      )}
    </div>
  );
}
