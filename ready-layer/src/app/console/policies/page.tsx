'use client';

/**
 * Console Policies Page - Policy management and evaluation
 *
 * What: View and manage enforcement policies.
 * Why: Policies provide deny-by-default governance for all operations.
 * What you can do: View policy rules, check decision history.
 *
 * Policies API: GET /api/policies → { v:1, kind:'policies.list', data:{ok:true, data:[{hash,size,created_at_unix_ms}], total:N} }
 * Decisions API: GET /api/decisions → { ok:true, data:[], total:0, trace_id }
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  HashDisplay,
  ErrorDisplay,
  SectionHeader,
} from '@/components/ui';

interface PolicyListItem {
  hash: string;
  size: number;
  created_at_unix_ms: number;
}

interface PolicyDecision {
  id: string;
  policy_id: string;
  result: string;
  timestamp: number;
}

export default function ConsolePoliciesPage() {
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [decisions, setDecisions] = useState<PolicyDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'policies' | 'decisions'>('policies');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [policiesRes, decisionsRes] = await Promise.all([
        fetch('/api/policies'),
        fetch('/api/decisions?limit=10'),
      ]);

      const policiesEnvelope = await policiesRes.json();
      const decisionsEnvelope = await decisionsRes.json();

      // Policies: { v:1, kind, data:{ok:true, data:[...PolicyListItem], total:N} }
      const policiesInner = policiesEnvelope.data;
      if (policiesInner?.ok) {
        setPolicies(Array.isArray(policiesInner.data) ? policiesInner.data : []);
      }

      // Decisions: { ok:true, data:[...Decision], total:N, trace_id }
      if (decisionsEnvelope.ok) {
        setDecisions(Array.isArray(decisionsEnvelope.data) ? decisionsEnvelope.data : []);
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
    fetchData();
  }, [fetchData]);

  const getDecisionColor = (result: string) => {
    switch (result?.toLowerCase()) {
      case 'allow':
        return 'bg-success/10 text-success border border-success/20';
      case 'deny':
        return 'bg-destructive/10 text-destructive border border-destructive/20';
      default:
        return 'bg-surface-elevated text-muted border border-border';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Policies"
        description="Policy management and evaluation. All operations pass through deny-by-default policy enforcement."
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('policies')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'policies'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
            type="button"
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'decisions'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
            type="button"
          >
            Recent Decisions
          </button>
        </nav>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay code={error.code} message={error.message} traceId={error.traceId} onRetry={fetchData} />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading policies..." />
      ) : activeTab === 'policies' ? (
        policies.length === 0 ? (
          <EmptyState
            title="No policies found"
            description="Use the CLI to add policies: requiem policy add <policy-file>"
          />
        ) : (
          <>
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Policy Hash</th>
                    <th>Size</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((policy) => (
                    <tr key={policy.hash}>
                      <td>
                        <HashDisplay hash={policy.hash} length={32} />
                      </td>
                      <td className="text-sm text-muted font-mono">
                        {policy.size ? `${policy.size.toLocaleString()} B` : '—'}
                      </td>
                      <td className="text-sm text-muted">
                        {policy.created_at_unix_ms
                          ? new Date(policy.created_at_unix_ms).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted">
              Total: {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}
            </p>
          </>
        )
      ) : decisions.length === 0 ? (
        <EmptyState
          title="No decisions recorded"
          description="Policy decisions will appear here when operations are evaluated."
        />
      ) : (
        <div className="space-y-4">
          <SectionHeader
            title="Recent Policy Decisions"
            description="Policy ID, result, and evaluation timestamp for each decision."
          />
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Decision ID</th>
                  <th>Policy ID</th>
                  <th>Result</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((decision) => (
                  <tr key={decision.id}>
                    <td>
                      <HashDisplay hash={decision.id} length={16} />
                    </td>
                    <td>
                      <HashDisplay hash={decision.policy_id} length={16} />
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDecisionColor(
                          decision.result,
                        )}`}
                      >
                        {decision.result?.toUpperCase() || '—'}
                      </span>
                    </td>
                    <td className="text-sm text-muted">
                      {decision.timestamp
                        ? new Date(decision.timestamp).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
