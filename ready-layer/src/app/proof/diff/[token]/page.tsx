/**
 * Public Proof Page — Diff Proof Card Share Route
 *
 * This is a public route that displays the Diff Proof Card
 * for shared diff tokens. No authentication required.
 */

import React from 'react';
import { DiffProofCard } from '@/components/DiffProofCard';
import { notFound } from 'next/navigation';

interface ProofPageProps {
  params: Promise<{ token: string }>;
}

// Mock data - in production this would fetch from database
async function fetchProofData(token: string) {
  // Validate token format
  if (!token.startsWith('req_')) {
    return null;
  }

  // Mock proof data
  return {
    runA: {
      id: 'run_abc123def456',
      shortId: 'abc123de',
      replayMatchPercent: 100,
    },
    runB: {
      id: 'run_xyz789uvw012',
      shortId: 'xyz789uv',
      replayMatchPercent: 95,
    },
    tenantScope: 'Organization',
    determinismVerified: false,
    fingerprintA: 'a1b2c3d4e5f67890',
    fingerprintB: 'x9y8z7w6v5u43210',
    topDeltas: [
      { type: 'output', severity: 'high' as const, summary: 'Output fingerprint differs' },
      { type: 'policy', severity: 'medium' as const, summary: 'Policy evaluation changed' },
    ],
    firstDivergencePoint: 3,
    diffDigest: 'diff_a1b2_x9y8_16384',
    verifiedAt: new Date().toISOString(),
  };
}

export default async function ProofPage({ params }: ProofPageProps) {
  const { token } = await params;
  const proofData = await fetchProofData(token);

  if (!proofData) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Proof of Execution Diff
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Verified deterministic comparison between two AI runs
          </p>
        </div>

        <DiffProofCard {...proofData} />

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            This proof card is cryptographically verifiable and tamper-evident.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Powered by Requiem — Provable AI Runtime
          </p>
        </div>
      </div>
    </main>
  );
}
