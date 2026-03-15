'use client';

import { useEffect, useState } from 'react';
import { normalizeEnvelope } from '@/lib/api-truth';

type IsolationPayload = {
  ok: boolean;
  tenant_id: string;
  isolation_status: 'enforced' | 'warning' | 'violation';
  scoped_paths?: { cas?: string; events?: string; audit?: string };
};

export default function TenantsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<IsolationPayload | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/tenants/isolation', { cache: 'no-store' });
        const envelope = normalizeEnvelope<IsolationPayload>(await response.json());
        if (!response.ok || !envelope.ok || !envelope.data) {
          setError(envelope.error?.message ?? `Request failed (${response.status})`);
          return;
        }
        setTenant(envelope.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Network error while loading tenant isolation');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tenants</h1>
        <p className="text-sm text-muted mt-1">Operator view of active tenant context and isolation route reachability.</p>
      </div>

      {loading && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Loading tenant isolation data…</div>}

      {!loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Tenant isolation endpoint unreachable</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
        </div>
      )}

      {!loading && !error && !tenant && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No tenant data returned.</div>}

      {!loading && !error && tenant && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Tenant context</p>
            <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
              {tenant.isolation_status}
            </span>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Tenant ID</dt>
              <dd className="font-mono text-foreground">{tenant.tenant_id}</dd>
            </div>
            <div>
              <dt className="text-muted">API signal</dt>
              <dd className="text-foreground">Isolation endpoint responded</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-border bg-surface-elevated p-3">
            <p className="text-xs uppercase tracking-wide text-muted">Scoped storage paths</p>
            <p className="text-xs text-muted mt-1">Paths are route-reported values only; no filesystem verification is implied.</p>
            <ul className="mt-2 space-y-1 text-xs font-mono text-foreground">
              <li>cas: {tenant.scoped_paths?.cas ?? 'not reported'}</li>
              <li>events: {tenant.scoped_paths?.events ?? 'not reported'}</li>
              <li>audit: {tenant.scoped_paths?.audit ?? 'not reported'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
