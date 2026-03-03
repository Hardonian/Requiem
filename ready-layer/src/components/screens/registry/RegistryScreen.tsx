'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorDisplay, LoadingState, PageHeader } from '@/components/ui';

type Obj = { digest: string; encoding: string; original_size: number; stored_size: number };

export function RegistryScreen() {
  const [items, setItems] = useState<Obj[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; traceId?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/objects?limit=20');
        const body = await res.json();
        if (!res.ok || body.error) {
          setError({ code: body?.error?.code ?? 'registry_error', message: body?.error?.message ?? 'Failed to load registry' });
          return;
        }
        setItems(body?.data?.data ?? []);
      } catch (e) {
        setError({ code: 'network_error', message: e instanceof Error ? e.message : 'Failed to load registry' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader title="Registry" description="Content-addressed package and object registry with deterministic digests." />
      {loading ? <LoadingState message="Loading registry objects..." /> : null}
      {error ? <ErrorDisplay code={error.code} message={error.message} traceId={error.traceId} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title="Registry is empty" description="Publish a package to populate the registry." /> : null}
      {!loading && !error && items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-gray-900">
              <tr><th className="px-4 py-2">Digest</th><th className="px-4 py-2">Encoding</th><th className="px-4 py-2">Original</th><th className="px-4 py-2">Stored</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.digest} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2 font-mono"><a className="text-emerald-600 hover:underline dark:text-emerald-400" href={`/registry/${item.digest}`}>{item.digest.slice(0, 16)}…</a></td>
                  <td className="px-4 py-2">{item.encoding}</td>
                  <td className="px-4 py-2">{item.original_size}</td>
                  <td className="px-4 py-2">{item.stored_size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
