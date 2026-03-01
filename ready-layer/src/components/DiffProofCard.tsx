/**
 * DiffProofCard — Viral Share Artifact
 *
 * A screenshot-worthy view showing run comparison proof
 * Safe redaction by default, no secrets
 */

'use client';

import React from 'react';
import { CheckCircle, XCircle, Copy, Shield, Fingerprint } from 'lucide-react';

interface DiffProofCardProps {
  runA: {
    id: string;
    shortId: string;
    replayMatchPercent: number;
  };
  runB: {
    id: string;
    shortId: string;
    replayMatchPercent: number;
  };
  tenantScope: string;
  determinismVerified: boolean;
  fingerprintA: string;
  fingerprintB: string;
  topDeltas: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    summary: string;
  }>;
  firstDivergencePoint: number | null;
  diffDigest: string;
  verifiedAt: string;
}

export function DiffProofCard({
  runA,
  runB,
  tenantScope,
  determinismVerified,
  fingerprintA,
  fingerprintB,
  topDeltas,
  firstDivergencePoint,
  diffDigest,
  verifiedAt,
}: DiffProofCardProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-white" />
            <h1 className="text-xl font-bold text-white">Diff Proof</h1>
          </div>
          <span className="text-sm text-blue-100 bg-blue-800/50 px-3 py-1 rounded-full">
            {tenantScope}
          </span>
        </div>
      </div>

      {/* Verification Badge */}
      <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center">
          {determinismVerified ? (
            <div className="flex items-center gap-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-6 py-3 rounded-full">
              <CheckCircle className="w-8 h-8" />
              <span className="text-2xl font-bold">DETERMINISM VERIFIED</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-6 py-3 rounded-full">
              <XCircle className="w-8 h-8" />
              <span className="text-2xl font-bold">DIVERGENCE DETECTED</span>
            </div>
          )}
        </div>
      </div>

      {/* Run Comparison */}
      <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-6">
          {/* Run A */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-500">RUN A</span>
              <button
                onClick={() => copyToClipboard(runA.id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <Copy className="w-3 h-3 text-gray-400" />
              </button>
            </div>
            <div className="font-mono text-lg font-bold text-gray-900 dark:text-white mb-2">
              {runA.shortId}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${runA.replayMatchPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {runA.replayMatchPercent}%
              </span>
            </div>
          </div>

          {/* Run B */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-500">RUN B</span>
              <button
                onClick={() => copyToClipboard(runB.id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <Copy className="w-3 h-3 text-gray-400" />
              </button>
            </div>
            <div className="font-mono text-lg font-bold text-gray-900 dark:text-white mb-2">
              {runB.shortId}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${runB.replayMatchPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {runB.replayMatchPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fingerprints */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-500">FINGERPRINTS</span>
        </div>
        <div className="grid grid-cols-2 gap-4 font-mono text-xs">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <code className="text-gray-600 dark:text-gray-400">{fingerprintA}...</code>
            <button
              onClick={() => copyToClipboard(fingerprintA)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <Copy className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <code className="text-gray-600 dark:text-gray-400">{fingerprintB}...</code>
            <button
              onClick={() => copyToClipboard(fingerprintB)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <Copy className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Deltas */}
      {topDeltas.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">TOP DELTAS</h3>
          <div className="space-y-2">
            {topDeltas.slice(0, 3).map((delta, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  delta.severity === 'high'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    : delta.severity === 'medium'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                }`}
              >
                <span className="text-xs font-bold uppercase">{delta.type}</span>
                <span className="text-sm">{delta.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* First Divergence */}
      {firstDivergencePoint !== null && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">
              First Divergence at Step {firstDivergencePoint + 1}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Shield className="w-4 h-4" />
            <span>Verified by Requiem</span>
          </div>
          <div className="flex items-center gap-4">
            <code className="text-xs text-gray-400">{diffDigest}...</code>
            <span className="text-xs text-gray-400">
              {new Date(verifiedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
