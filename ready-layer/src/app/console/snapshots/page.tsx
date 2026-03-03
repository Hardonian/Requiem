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
  VerificationBadge 
} from '@/components/ui';

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
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Snapshots"
        description="State snapshots for rollback, migration, and disaster recovery. Each snapshot is checksummed for integrity verification."
      />

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
          description="Use the CLI to create snapshots: reach snapshots create --name <name>"
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Checksum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gated
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {snapshots.map((snap) => (
                <tr key={snap.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                    <HashDisplay hash={snap.id} length={16} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {snap.name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <HashDisplay hash={snap.checksum} length={16} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
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
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {snap.createdAt?.substring(0, 10) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRestore(snap.id, snap.name)}
                      disabled={restoringId === snap.id}
                      className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors"
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
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
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
