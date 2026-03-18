'use client';

import { useEffect, useState } from 'react';
import { normalizeEnvelope } from '@/lib/api-truth';
import { classifyApiFailure } from '@/lib/route-truth';
import { RouteTruthStateCard, TruthActionButton } from '@/components/ui';

type IsolationPayload = {
  ok: boolean;
  tenant_id: string;
  isolation_status: 'enforced' | 'warning' | 'violation';
  scoped_paths?: { cas?: string; events?: string; audit?: string };
};

export default function TenantsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number; code?: string } | null>(null);
  const [tenant, setTenant] = useState<IsolationPayload | null>(null);

  async function loadTenant() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tenants/isolation', { cache: 'no-store' });
      const envelope = normalizeEnvelope<IsolationPayload>(await response.json());
      if (!response.ok || !envelope.ok || !envelope.data) {
        setError({
          message: envelope.error?.message ?? `Request failed (${response.status})`,
          status: response.status,
          code: envelope.error?.code,
        });
        return;
      }
      setTenant(envelope.data);
    } catch (fetchError) {
      setError({ message: fetchError instanceof Error ? fetchError.message : 'Network error while loading tenant isolation', status: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenant();
  }, []);

  const failure = error ? classifyApiFailure({ status: error.status, code: error.code, message: error.message }) : null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Tenant Isolation</h1>
        <p className="text-sm text-muted mt-1">Read-only tenancy disclosure for the current authenticated user scope. This route currently shows stubbed isolation metadata, not live shared-tenant administration.</p>
      </div>

      {loading && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Loading tenant isolation data…</div>}

      {!loading && failure && (
        <RouteTruthStateCard
          tone={failure.kind === 'forbidden' ? 'critical' : 'warning'}
          stateLabel={failure.kind}
          title={failure.title}
          detail={`${failure.detail} Raw error: ${error?.message}`}
          nextStep={failure.nextStep}
          actions={
            <TruthActionButton
              label="Retry tenant isolation query"
              semantics="runtime-backed"
              onClick={() => {
                void loadTenant();
              }}
            />
          }
        />
      )}

      {!loading && !error && !tenant && (
        <RouteTruthStateCard
          stateLabel="no-data"
          title="No tenant data returned"
          detail="Request completed successfully but tenant-isolation payload was empty."
          nextStep="Confirm tenant context headers and backend tenant registration, then retry."
        />
      )}

      {!loading && !error && tenant && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Tenant context</p>
            <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
              {tenant.isolation_status}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted">Tenant ID</dt>
              <dd className="font-mono text-foreground">{tenant.tenant_id}</dd>
            </div>
            <div>
              <dt className="text-muted">Route mode</dt>
              <dd className="text-foreground">Stub disclosure payload returned</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-border bg-surface-elevated p-3">
            <p className="text-xs uppercase tracking-wide text-muted">Scoped storage paths</p>
            <p className="mt-1 text-xs text-muted">Example tenant-scoped path disclosure only; no filesystem or cross-replica verification is implied.</p>
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
