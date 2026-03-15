interface OperationalTruthBannerProps {
  className?: string;
}

function isVerifyMode(): boolean {
  return process.env.REQUIEM_ROUTE_VERIFY_MODE === '1' && process.env.NODE_ENV !== 'production';
}

function resolveBackendState(): {
  label: string;
  tone: 'warning' | 'neutral';
  detail: string;
} {
  if (!process.env.REQUIEM_API_URL) {
    return {
      label: 'Backend not configured',
      tone: 'warning',
      detail: 'REQUIEM_API_URL is not set. Runtime-backed pages will show degraded or empty states until configured.',
    };
  }

  return {
    label: 'Backend configured (not reachability-proven)',
    tone: 'neutral',
    detail: `REQUIEM_API_URL is set to ${process.env.REQUIEM_API_URL}. Route behavior still depends on backend reachability and data availability.`,
  };
}

function resolveAuthState(): {
  label: string;
  tone: 'warning' | 'neutral';
  detail: string;
} {
  if (isVerifyMode()) {
    return {
      label: 'Dev auth verification mode (synthetic auth)',
      tone: 'warning',
      detail: 'Middleware injects synthetic authenticated headers for local route validation only. This is not production-backed authentication.',
    };
  }

  return {
    label: 'Real auth mode (session-enforced)',
    tone: 'neutral',
    detail: 'Protected routes require a real Supabase user session in middleware.',
  };
}

function resolveReachabilityState(): {
  label: string;
  tone: 'warning' | 'neutral';
  detail: string;
} {
  return {
    label: 'Backend reachability not proven in shell',
    tone: 'warning',
    detail:
      'This shell banner does not perform network probes. Treat backend reachability and data freshness as route-level evidence only.',
  };
}

function badgeClass(tone: 'warning' | 'neutral'): string {
  return tone === 'neutral'
    ? 'bg-slate-500/10 text-slate-700 border-slate-300'
    : 'bg-amber-500/10 text-amber-700 border-amber-200';
}

export function OperationalTruthBanner({ className = '' }: OperationalTruthBannerProps) {
  const authState = resolveAuthState();
  const backendState = resolveBackendState();
  const reachabilityState = resolveReachabilityState();
  const verifyMode = isVerifyMode();

  return (
    <div className={`mx-6 mt-6 rounded-xl border-2 border-border bg-surface p-4 ${className}`}>
      {verifyMode && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
          Synthetic authentication active (dev verification only) — production authentication is unchanged.
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Operational truth (screenshot-visible state contract)</p>
      <p className="mt-1 text-xs text-muted">Auth/session validity, backend configuration, backend reachability, and data availability are independent signals and must be interpreted separately.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(authState.tone)}`}>
            {authState.label}
          </span>
          <p className="mt-1 text-sm text-muted">{authState.detail}</p>
        </div>
        <div>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(backendState.tone)}`}>
            {backendState.label}
          </span>
          <p className="mt-1 text-sm text-muted">{backendState.detail}</p>
        </div>
        <div>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(reachabilityState.tone)}`}>
            {reachabilityState.label}
          </span>
          <p className="mt-1 text-sm text-muted">{reachabilityState.detail}</p>
        </div>
      </div>
    </div>
  );
}
