'use client';

import { useEffect, useState } from 'react';

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
    <main className="mx-auto max-w-4xl space-y-4 px-6 py-12">
      <h1 className="text-3xl font-semibold">System Status</h1>
      {!data && !error ? <p>Loading status…</p> : null}
      {error ? <p className="text-red-600">Status unavailable. trace_id: {error}</p> : null}
      {data ? (
        <dl className="grid grid-cols-1 gap-3 rounded border p-4 text-sm md:grid-cols-2">
          <div><dt className="font-semibold">Git SHA</dt><dd>{data.git_sha}</dd></div>
          <div><dt className="font-semibold">Build Time</dt><dd>{data.build_time}</dd></div>
          <div><dt className="font-semibold">Environment</dt><dd>{data.environment}</dd></div>
          <div><dt className="font-semibold">Prompt Version</dt><dd>{data.prompt_version}</dd></div>
          <div><dt className="font-semibold">Core Version</dt><dd>{data.core_version}</dd></div>
          <div><dt className="font-semibold">Backend</dt><dd>{data.backend.reachable ? `reachable (${data.backend.status})` : 'unreachable'}</dd></div>
          <div><dt className="font-semibold">trace_id</dt><dd>{data.trace_id}</dd></div>
        </dl>
      ) : null}
    </main>
  );
}
