'use client';

import { useEffect, useState } from 'react';
import { MarketingShell } from '@/components/marketing/MarketingShell';

type StatusResponse = {
  git_sha: string;
  build_time: string;
  environment: string;
  prompt_version: string;
  core_version: string;
  backend: { reachable: boolean; status: number };
  trace_id: string;
};

async function fetchWithRetry(signal: AbortSignal): Promise<StatusResponse> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('/api/status', { signal, cache: 'no-store' });
      const payload = (await response.json()) as StatusResponse;
      if (!response.ok) {
        throw new Error(payload.trace_id ?? `status_${response.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('status_fetch_failed');
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error('status_fetch_failed');
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-border last:border-0 gap-1">
      <dt className="text-sm font-semibold text-muted sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm font-mono text-foreground break-all">{value}</dd>
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWithRetry(controller.signal)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'unknown_error'));

    return () => controller.abort();
  }, []);

  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">System</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl font-display">
          Deployment Status
        </h1>
        <p className="mt-4 text-muted">
          Runtime version metadata and backend reachability for this deployment.
        </p>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        {!data && !error && (
          <div className="rounded-xl border border-border bg-surface p-8 animate-pulse">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-5 bg-surface-elevated rounded w-3/4" />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6" role="alert">
            <p className="text-sm font-semibold text-destructive mb-1">Status unavailable</p>
            <p className="text-sm text-muted font-mono">trace_id: {error}</p>
          </div>
        )}

        {data && (
          <div className="rounded-xl border border-border bg-surface p-8">
            <dl>
              <StatusRow label="Git SHA" value={data.git_sha} />
              <StatusRow label="Build Time" value={data.build_time} />
              <StatusRow label="Environment" value={data.environment} />
              <StatusRow label="Prompt Version" value={data.prompt_version} />
              <StatusRow label="Core Version" value={data.core_version} />
              <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-border gap-1">
                <dt className="text-sm font-semibold text-muted sm:w-40 shrink-0">Backend</dt>
                <dd className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${data.backend.reachable ? 'bg-success' : 'bg-destructive'}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-sm font-medium ${data.backend.reachable ? 'text-success' : 'text-destructive'}`}
                  >
                    {data.backend.reachable ? `reachable (${data.backend.status})` : 'unreachable'}
                  </span>
                </dd>
              </div>
              <StatusRow label="Trace ID" value={data.trace_id} />
            </dl>
          </div>
        )}
      </section>
    </MarketingShell>
  );
}
