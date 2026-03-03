'use client';

/**
 * Console Policies Page - Policy management and evaluation
 * 
 * What: View and manage enforcement policies.
 * Why: Policies provide deny-by-default governance for all operations.
 * What you can do: View policy rules, check decision history.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  PageHeader, 
  LoadingState, 
  EmptyState,
  HashDisplay,
  ErrorDisplay,
  SectionHeader 
} from '@/components/ui';

interface Policy {
  name: string;
  type: string;
  ruleCount: number;
  activeVersion: string;
  description?: string;
  lastEvaluated?: string;
}

interface PolicyDecision {
  id: string;
  policyName: string;
  inputHash: string;
  outputHash: string;
  proofHash: string;
  decision: 'allow' | 'deny';
  timestamp: string;
}

export default function ConsolePoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
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
      
      const policiesData = await policiesRes.json();
      const decisionsData = await decisionsRes.json();
      
      if (policiesData.ok) {
        setPolicies(policiesData.policies || []);
      }
      
      if (decisionsData.ok) {
        setDecisions(decisionsData.decisions || []);
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

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'allow':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'deny':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Policies"
        description="Policy management and evaluation. All operations pass through deny-by-default policy enforcement."
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('policies')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'policies'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
            type="button"
          >
            Policies
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'decisions'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
            type="button"
          >
            Recent Decisions
          </button>
        </nav>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6">
          <ErrorDisplay
            code={error.code}
            message={error.message}
            traceId={error.traceId}
            onRetry={fetchData}
          />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rules
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Version
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {policies.map((policy, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {policy.name}
                        </div>
                        {policy.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {policy.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(policy.type)}`}>
                        {policy.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {policy.ruleCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <HashDisplay hash={policy.activeVersion} length={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        decisions.length === 0 ? (
          <EmptyState
            title="No decisions recorded"
            description="Policy decisions will appear here when operations are evaluated."
          />
        ) : (
          <div className="space-y-4">
            <SectionHeader
              title="Recent Policy Decisions"
              description="Input hash, output hash, proof hash, and allow/deny status for each evaluation."
            />
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Policy
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Decision
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Input Hash
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Output Hash
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Proof Hash
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {decisions.map((decision) => (
                    <tr key={decision.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {decision.policyName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          decision.decision === 'allow' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {decision.decision.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <HashDisplay hash={decision.inputHash} length={16} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <HashDisplay hash={decision.outputHash} length={16} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <HashDisplay hash={decision.proofHash} length={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Total count */}
      {!loading && activeTab === 'policies' && policies.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Total: {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}
        </div>
      )}
    </div>
  );
}
