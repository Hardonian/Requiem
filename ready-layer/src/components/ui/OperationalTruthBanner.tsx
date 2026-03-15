interface OperationalTruthBannerProps {
  className?: string;
}

function isVerifyMode(): boolean {
  return process.env.REQUIEM_ROUTE_VERIFY_MODE === '1' && process.env.NODE_ENV !== 'production';
}

export function OperationalTruthBanner({ className = '' }: OperationalTruthBannerProps) {
  const verifyMode = isVerifyMode();
  const backendConfigured = Boolean(process.env.REQUIEM_API_URL);

  // In normal production operation with backend configured and no synthetic auth:
  // suppress the banner entirely — it's just noise.
  if (backendConfigured && !verifyMode) {
    return null;
  }

  return (
    <div className={`mx-6 mt-6 space-y-2 ${className}`} role="status" aria-label="Operational state notices">
      {verifyMode && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-500/10 px-4 py-2.5 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs font-semibold text-amber-700">
            Dev verification mode — synthetic auth active. Production authentication is unchanged.
          </p>
        </div>
      )}
      {!backendConfigured && (
        <div className="rounded-lg border border-border bg-surface px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-muted/40 shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted">
              Engine not connected.{' '}
              <code className="font-mono bg-surface-elevated px-1 py-0.5 rounded text-[11px]">REQUIEM_API_URL</code>
              {' '}is not set — runtime-backed pages show degraded states.
            </p>
          </div>
          <a
            href="/docs"
            className="text-xs font-medium text-muted hover:text-foreground transition-colors shrink-0 flex items-center gap-1"
          >
            Setup guide
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      )}
    </div>
  );
}
