/**
 * Run Detail Page with Proof Panel
 */

import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Fingerprint, GitCompare, Share2, Activity } from 'lucide-react';
import { getPredictions, getOutcomes, getSignals, getCases } from '@/lib/intelligence-store';

interface RunPageProps {
  params: Promise<{ runId: string }>;
}

// Mock data - in production this would fetch from database
async function fetchRunData(runId: string) {
  if (!runId.startsWith('run_')) {
    return null;
  }

  return {
    id: runId,
    shortId: runId.substring(4, 12),
    tenantId: 'tenant_123',
    toolName: 'system.echo',
    status: 'completed',
    inputFingerprint: 'a1b2c3d4e5f67890abcd1234',
    outputFingerprint: 'x9y8z7w6v5u43210wxyz9876',
    replayVerified: true,
    replayMatchPercent: 100,
    createdAt: new Date().toISOString(),
  };
}

export default async function RunPage({ params }: RunPageProps) {
  const { runId } = await params;
  const run = await fetchRunData(runId);

  if (!run) {
    notFound();
  }

  const predictions = getPredictions(run.tenantId, runId);
  const outcomes = getOutcomes(run.tenantId, runId);
  const signals = getSignals(run.tenantId).slice(0, 5);
  const similarCases = getCases(run.tenantId).slice(0, 3);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/runs" className="hover:text-gray-700">Runs</Link>
            <span>/</span>
            <span className="font-mono">{run.shortId}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Run Details
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Proof Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <h2 className="text-xl font-semibold">Proof Panel</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Determinism</div>
                  <div className="flex items-center gap-2">
                    {run.replayVerified ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          Verified
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-600">Unverified</span>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Replay Match</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${run.replayMatchPercent}%` }}
                      />
                    </div>
                    <span className="font-semibold">{run.replayMatchPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Fingerprints */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Fingerprint className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Input Fingerprint</div>
                    <code className="text-sm font-mono">{run.inputFingerprint.substring(0, 24)}...</code>
                  </div>
                  <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Fingerprint className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Output Fingerprint</div>
                    <code className="text-sm font-mono">{run.outputFingerprint.substring(0, 24)}...</code>
                  </div>
                  <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/runs/${runId}/diff`}
                  className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <GitCompare className="w-5 h-5" />
                  <span>Compare with...</span>
                </Link>
                <Link
                  href={`/runs/${runId}/lineage`}
                  className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <Activity className="w-5 h-5" />
                  <span>View Lineage</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Predictions & Outcomes</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded"><div className="text-gray-500">Predictions</div><div className="font-semibold">{predictions.length}</div></div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded"><div className="text-gray-500">Outcomes</div><div className="font-semibold">{outcomes.length}</div></div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Similar Solved Cases</h3>
              <ul className="space-y-2 text-sm">
                {similarCases.length === 0 && <li className="text-gray-500">No case matches for this tenant.</li>}
                {similarCases.map((item) => <li key={item.case_id} className="border rounded p-2"><p className="font-medium">{item.summary}</p><p className="text-xs text-gray-500">{item.failing_command}</p></li>)}
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Risk & Signals</h3>
              <ul className="space-y-2 text-sm">
                {signals.length === 0 && <li className="text-gray-500">No recent signals.</li>}
                {signals.map((item) => <li key={item.signal_id} className="flex justify-between border-b pb-1"><span>{item.signal_type}</span><span className="font-mono text-xs">{item.severity}</span></li>)}
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Run Info</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Tool:</span>
                  <span className="ml-2 font-medium">{run.toolName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 font-medium capitalize">{run.status}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2">{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
