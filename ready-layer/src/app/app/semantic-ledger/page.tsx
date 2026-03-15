import Link from 'next/link';

export default function SemanticLedgerPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Semantic Ledger</h1>
        <p className="text-sm text-muted mt-1">This UI currently has no wired API route. It intentionally avoids fabricated state or metrics.</p>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
        <p className="text-sm font-medium text-warning">Unconfigured surface</p>
        <p className="text-sm text-muted mt-1">
          Expected route <code className="font-mono">/api/semantic-ledger</code> is not implemented in this repository, so live ledger data cannot be displayed.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        Once the API exists, this page should render: current tenant context, item count returned by API, and the latest successful response timestamp.
      </div>

      <div>
        <Link href="/app/diagnostics" className="text-accent hover:underline text-sm">
          Open diagnostics
        </Link>
      </div>
    </div>
  );
}
