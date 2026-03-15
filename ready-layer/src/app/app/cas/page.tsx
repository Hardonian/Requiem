'use client';

import { useEffect, useState } from 'react';
import { normalizeEnvelope } from '@/lib/api-truth';

type CASIntegrity = {
  ok: boolean;
  objects_checked: number;
  objects_corrupt: number;
  errors: string[];
  cas_format_version: number;
  hash_algorithm_version: number;
};

export default function CASPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CASIntegrity | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/cas/integrity', { cache: 'no-store' });
        const envelope = normalizeEnvelope<CASIntegrity>(await response.json());
        if (!response.ok || !envelope.ok || !envelope.data) {
          setError(envelope.error?.message ?? `Request failed (${response.status})`);
          return;
        }
        setReport(envelope.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load CAS integrity report');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CAS Integrity</h1>
        <p className="text-sm text-muted mt-1">Live integrity check response from <code className="font-mono">/api/cas/integrity</code>.</p>
      </div>

      {loading && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Loading CAS report…</div>}

      {!loading && error && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-warning">CAS integrity check unavailable</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <p className="mt-2 text-xs text-muted">If REQUIEM_API_URL is not configured, this degraded state is expected.</p>
        </div>
      )}

      {!loading && !error && report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Objects checked</p>
            <p className="text-2xl font-semibold text-foreground">{report.objects_checked}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Corrupt objects</p>
            <p className="text-2xl font-semibold text-foreground">{report.objects_corrupt}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">API status</p>
            <p className="text-2xl font-semibold text-foreground">{report.ok ? 'reachable' : 'degraded'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
