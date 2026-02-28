'use client';

import { useMemo, useState } from 'react';
import sample from '@/lib/evidence-sample-run.json';
import type { AdapterResult, EvidenceBundle } from '@/lib/evidence-viewer';

function safeParseBundle(raw: string): EvidenceBundle | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.run?.id || !Array.isArray(parsed?.events)) return null;
    return parsed as EvidenceBundle;
  } catch {
    return null;
  }
}

export default function EvidenceViewerPage() {
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [adapterResult, setAdapterResult] = useState<AdapterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(() => {
    if (!bundle) return [];
    return bundle.events
      .map((event) => event.stepId)
      .filter((stepId): stepId is string => Boolean(stepId));
  }, [bundle]);

  async function runAction(action: 'verify' | 'replay') {
    if (!bundle) {
      setError('Load a sample run or upload a run bundle first.');
      return;
    }
    setError(null);
    const response = await fetch('/api/demo/evidence/adapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, runId: bundle.run.id })
    });
    const data = await response.json();
    setAdapterResult(data);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-gray-900">Reach OSS Demo — Evidence Viewer</h1>
          <p className="mt-2 text-sm text-gray-600">Inspect run transcripts, verify outputs, and replay through the CLI when available.</p>
          <p className="mt-1 text-xs text-gray-500">Enterprise (stub): Team RBAC, cloud signing, and tenant audit streaming are coming later.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Load Evidence</h2>
            <button onClick={() => setBundle(sample as EvidenceBundle)} className="mt-3 rounded bg-gray-900 px-3 py-2 text-sm text-white">Load sample run</button>
            <label className="mt-3 block text-sm text-gray-700">
              Upload JSON bundle
              <input
                className="mt-1 block w-full rounded border border-gray-300 p-2"
                type="file"
                accept="application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const parsed = safeParseBundle(await file.text());
                  if (!parsed) {
                    setError('Invalid bundle format.');
                    return;
                  }
                  setError(null);
                  setBundle(parsed);
                }}
              />
            </label>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Verify & Replay</h2>
            <div className="mt-3 flex gap-2">
              <button onClick={() => runAction('verify')} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">Run verify</button>
              <button onClick={() => runAction('replay')} className="rounded bg-green-600 px-3 py-2 text-sm text-white">Run replay</button>
            </div>
            {adapterResult && (
              <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-medium">{adapterResult.ok ? 'PASS' : 'Fallback'}</p>
                <p>{adapterResult.summary}</p>
                {adapterResult.installHint && <p className="mt-1 text-xs text-gray-600">{adapterResult.installHint}</p>}
              </div>
            )}
          </div>
        </section>

        {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {bundle && (
          <section className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Run Metadata</h2>
              <p className="mt-2 text-sm">Run ID: <span className="font-mono">{bundle.run.id}</span></p>
              <p className="text-sm">Pack: {bundle.run.pack}</p>
              <p className="text-sm">Fingerprint: <span className="font-mono">{bundle.run.fingerprint ?? 'not present'}</span></p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Transcript Timeline</h2>
              <ul className="mt-2 space-y-2">
                {bundle.events.map((event) => (
                  <li key={event.id} className="rounded border border-gray-100 p-3 text-sm">
                    <p className="font-medium">{event.type} · {event.timestamp}</p>
                    <p>{event.message}</p>
                    <p className="text-xs text-gray-600">Step: {event.stepId ?? 'not provided'} · Proof hash: {event.proofHash ?? 'not provided'}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">Stable step identifiers detected: {steps.join(', ') || 'none'}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Verification Scope</h2>
              <p className="mt-2 text-xs font-semibold uppercase text-gray-700">What is verified</p>
              <ul className="list-disc pl-5 text-sm">
                {bundle.verify.whatIsVerified.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-2 text-xs font-semibold uppercase text-gray-700">What is not verified</p>
              <ul className="list-disc pl-5 text-sm">
                {bundle.verify.whatIsNotVerified.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Export</h2>
              <a
                className="mt-2 inline-block rounded bg-gray-900 px-3 py-2 text-sm text-white"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(bundle, null, 2))}`}
                download={`${bundle.run.id}.evidence.json`}
              >
                Download evidence JSON
              </a>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
