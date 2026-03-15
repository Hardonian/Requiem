'use client';

/**
 * Console Capabilities Page - Capability token management
 *
 * What: Manage capability tokens for authorization.
 * Why: Capabilities provide fine-grained, revocable access control.
 * What you can do: View tokens, revoke capabilities, check expiration.
 *
 * API: GET /api/caps → { v:1, kind:'caps.list', data:{ok:true, data:[{actor,seq,data_hash,event_type}], total:N} }
 * API: DELETE /api/caps?id=X → { v:1, kind:'caps.revoke', data:{ok:true, fingerprint, revoked} }
 */

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, LoadingState, EmptyState, HashDisplay, ErrorDisplay } from '@/components/ui';

interface CapabilityItem {
  actor: string;
  seq: number;
  data_hash: string;
  event_type: string;
}

export default function ConsoleCapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [revokingSeq, setRevokingSeq] = useState<number | null>(null);

  const fetchCapabilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/caps?limit=100');
      const envelope = await response.json();

      // API: { v:1, kind:'caps.list', data:{ok:true, data:[...], total:N} }
      const inner = envelope.data;
      if (inner?.ok) {
        setCapabilities(Array.isArray(inner.data) ? inner.data : []);
      } else {
        setError({
          code: envelope.error?.code ?? 'E_FETCH_FAILED',
          message: envelope.error?.message ?? 'Failed to fetch capabilities',
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

  const handleRevoke = useCallback(
    async (item: CapabilityItem) => {
      if (!window.confirm(`Revoke capability for actor ${item.actor} (seq ${item.seq})?`)) return;

      setRevokingSeq(item.seq);
      try {
        const response = await fetch(`/api/caps?id=${encodeURIComponent(item.data_hash)}`, {
          method: 'DELETE',
        });
        const envelope = await response.json();
        const inner = envelope.data;

        if (inner?.ok) {
          setCapabilities((prev) => prev.filter((cap) => cap.seq !== item.seq));
        } else {
          setError({
            code: envelope.error?.code ?? 'E_REVOKE_FAILED',
            message: envelope.error?.message ?? 'Failed to revoke capability',
          });
        }
      } catch (err) {
        setError({
          code: 'E_NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network error occurred',
        });
      } finally {
        setRevokingSeq(null);
      }
    },
    [],
  );

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
        <>
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Actor</th>
                  <th>Event Type</th>
                  <th>Data Hash</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map((cap) => (
                  <tr key={cap.seq}>
                    <td className="font-mono text-muted text-sm">#{cap.seq}</td>
                    <td className="text-sm text-foreground font-mono">{cap.actor || '—'}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                        {cap.event_type || '—'}
                      </span>
                    </td>
                    <td>
                      <HashDisplay hash={cap.data_hash} length={16} />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleRevoke(cap)}
                        disabled={revokingSeq === cap.seq}
                        className="text-destructive hover:text-destructive/80 disabled:opacity-50 text-sm font-medium transition-colors"
                        type="button"
                      >
                        {revokingSeq === cap.seq ? 'Revoking...' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-muted">
            Total: {capabilities.length} capability token{capabilities.length !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}
