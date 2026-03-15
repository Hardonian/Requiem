'use client';

import { useMemo, useState } from 'react';
import { RouteTruthStateCard, TruthActionButton } from '@/components/ui';

export default function InteropPlaygroundPage() {
  const [payload, setPayload] = useState('{"action":"opened","repository":"reachhq/requiem"}');
  const [engine, setEngine] = useState('copilot');

  const parsed = useMemo(() => {
    try {
      const data = JSON.parse(payload) as Record<string, unknown>;
      return {
        ok: true,
        event: {
          type: String(data.action ?? 'unknown'),
          source: 'interop.playground',
          payload_cas: 'cas:preview',
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
    }
  }, [payload]);

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Interop Playground</h1>
      <RouteTruthStateCard
        stateLabel="local-only interactive route"
        title="Interop playground is local preview only"
        detail="This route parses payload JSON and renders a preview event. It does not submit approvals, mutate kernel state, or create pull requests in this repository."
        nextStep="Use this page for payload shaping only; run real approval or PR workflows from runtime-backed routes/tooling."
        tone="warning"
      />

      <textarea
        className="h-44 w-full rounded border p-3 font-mono text-sm"
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
      />

      <section className="rounded border p-4">
        <h2 className="font-medium">Normalized Event</h2>
        <pre className="mt-2 overflow-x-auto bg-gray-50 p-3 text-xs">{JSON.stringify(parsed, null, 2)}</pre>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-medium">Review Panel</h2>
        <div className="mt-2 flex items-center gap-3">
          <label htmlFor="engine">Engine</label>
          <select id="engine" className="rounded border px-2 py-1" value={engine} onChange={(event) => setEngine(event.target.value)}>
            <option value="copilot">copilot</option>
            <option value="claude">claude</option>
            <option value="qwen">qwen</option>
            <option value="semgrep">semgrep</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TruthActionButton
            label="Approve correction proposal"
            onClick={() => {}}
            disabled
            disabledReason="no approval API is wired for this route"
            semantics="local-only"
          />
          <TruthActionButton
            label="Open PR"
            onClick={() => {}}
            disabled
            disabledReason="this route does not create pull requests"
            semantics="informational"
          />
        </div>
      </section>
    </main>
  );
}
