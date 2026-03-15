'use client';

import { useEffect, useState } from 'react';
import { normalizeEnvelope } from '@/lib/api-truth';
import { classifyApiFailure } from '@/lib/route-truth';
import { RouteTruthStateCard, TruthActionButton } from '@/components/ui';

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
  const [error, setError] = useState<{ message: string; status?: number; code?: string } | null>(null);
  const [report, setReport] = useState<CASIntegrity | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cas/integrity', { cache: 'no-store' });
      const envelope = normalizeEnvelope<CASIntegrity>(await response.json());
      if (!response.ok || !envelope.ok || !envelope.data) {
        setError({
          message: envelope.error?.message ?? `Request failed (${response.status})`,
          status: response.status,
          code: envelope.error?.code,
        });
        return;
      }
      setReport(envelope.data);
    } catch (fetchError) {
      setError({ message: fetchError instanceof Error ? fetchError.message : 'Failed to load CAS integrity report', status: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  const failure = error ? classifyApiFailure({ status: error.status, code: error.code, message: error.message }) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CAS Integrity</h1>
        <p className="text-sm text-muted mt-1">Live integrity response from <code className="font-mono">/api/cas/integrity</code>, with explicit runtime failure classification.</p>
      </div>

      {loading && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Loading CAS report…</div>}

      {!loading && failure && (
        <RouteTruthStateCard
          tone="warning"
          stateLabel={failure.kind}
          title={failure.title}
          detail={`${failure.detail} Raw error: ${error?.message}`}
          nextStep={failure.nextStep}
          actions={
            <TruthActionButton
              label="Retry CAS integrity"
              semantics="runtime-backed"
              onClick={() => {
                void loadReport();
              }}
            />
          }
        />
      )}

      {!loading && !error && report && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Objects checked</p>
            <p className="text-2xl font-semibold text-foreground">{report.objects_checked}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Corrupt objects</p>
            <p className="text-2xl font-semibold text-foreground">{report.objects_corrupt}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Integrity state</p>
            <p className="text-2xl font-semibold text-foreground">{report.ok ? 'reachable' : 'degraded'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
