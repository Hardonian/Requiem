'use client';

/**
 * Console Capabilities Page - Capability token management
 * 
 * What: Manage capability tokens for authorization.
 * Why: Capabilities provide fine-grained, revocable access control.
 * What you can do: View tokens, revoke capabilities, check expiration.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  PageHeader, 
  LoadingState, 
  EmptyState,
  HashDisplay,
  ErrorDisplay 
} from '@/components/ui';

interface Capability {
  id: string;
  name: string;
  fingerprint: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  revokedAt: string | null;
}

export default function ConsoleCapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchCapabilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/caps?limit=100');
      const data = await response.json();
      
      if (data.ok) {
        setCapabilities(data.capabilities || []);
      } else {
        setError({
          code: data.error?.code || 'E_FETCH_FAILED',
          message: data.error?.message || 'Failed to fetch capabilities',
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
    fetchCapabilities();
  }, [fetchCapabilities]);

  const handleRevoke = useCallback(async (id: string) => {
    if (!confirm(`Are you sure you want to revoke capability ${id.substring(0, 16)}...?`)) return;
    
    setRevokingId(id);
    try {
      const response = await fetch(`/api/caps?id=${id}`, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.ok) {
        setCapabilities(prev => prev.map(cap => 
          cap.id === id ? { ...cap, revoked: true, revokedAt: new Date().toISOString() } : cap
        ));
      } else {
        setError({
          code: data.error?.code || 'E_REVOKE_FAILED',
          message: data.error?.message || 'Failed to revoke capability',
        });
      }
    } catch (err) {
      setError({
        code: 'E_NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
    } finally {
      setRevokingId(null);
    }
  }, []);

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getStatus = (cap: Capability) => {
    if (cap.revoked) return 'revoked';
    if (isExpired(cap.expiresAt)) return 'expired';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'revoked':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Capabilities"
        description="Capability tokens for fine-grained authorization. Tokens are cryptographically signed and can be revoked at any time."
      />

      {/* Error */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchCapabilities}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading capabilities..." />
      ) : capabilities.length === 0 ? (
        <EmptyState
          title="No capabilities found"
          description="Use the CLI to create capabilities: reach caps mint --name <name> --scope <scope>"
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
                  Scopes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fingerprint
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {capabilities.map((cap) => {
                const status = getStatus(cap);
                return (
                  <tr key={cap.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                      <HashDisplay hash={cap.id} length={16} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {cap.name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {cap.scopes?.map((scope, idx) => (
                          <span 
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          >
                            {scope}
                          </span>
                        )) || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <HashDisplay hash={cap.fingerprint} length={16} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {cap.expiresAt 
                        ? new Date(cap.expiresAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      {status === 'active' && (
                        <button
                          onClick={() => handleRevoke(cap.id)}
                          disabled={revokingId === cap.id}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
                          type="button"
                        >
                          {revokingId === cap.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {!loading && capabilities.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Total: {capabilities.length} capability{capabilities.length !== 1 ? 'ies' : ''}
          </span>
          <span>
            Active: {capabilities.filter(c => getStatus(c) === 'active').length} | 
            Revoked: {capabilities.filter(c => getStatus(c) === 'revoked').length} | 
            Expired: {capabilities.filter(c => getStatus(c) === 'expired').length}
          </span>
        </div>
      )}
    </div>
  );
}
