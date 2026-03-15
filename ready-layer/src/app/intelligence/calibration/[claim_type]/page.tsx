import type { Metadata } from 'next';
import Link from 'next/link';
import { loadCalibrationReport } from '@/lib/calibration-report';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Calibration Drilldown',
  description: 'Per-claim-type calibration bin detail.',
};

export default async function CalibrationClaimPage({ params }: { params: Promise<{ claim_type: string }> }) {
  const claim = (await params).claim_type.toUpperCase();
  const rows = loadCalibrationReport().filter((r) => r.claim_type === claim);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted mb-1">
        <Link href="/intelligence/calibration" className="text-accent hover:underline">Calibration</Link>
        <span>/</span>
        <span className="text-foreground">{claim}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
          Calibration: {claim}
        </h1>
        <p className="text-muted text-sm mt-1">Bin-level calibration data for this claim type.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-3">
          <svg className="h-8 w-8 text-muted/40 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-semibold text-foreground">Insufficient data</p>
          <p className="text-xs text-muted">
            Not enough samples (n &lt; threshold) to compute calibration bins for claim type{' '}
            <span className="font-mono bg-surface-elevated px-1 rounded">{claim}</span>.
          </p>
          <p className="text-xs text-muted">
            Set <code className="font-mono bg-surface-elevated px-1 rounded">REQUIEM_INTELLIGENCE_STORE_DIR</code> and
            ensure prediction outcomes are being recorded.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Bin range</th>
                <th>Count</th>
                <th>Avg predicted p</th>
                <th>Empirical freq</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows[0].bins.map((bin) => (
                <tr key={bin.bin_index}>
                  <td className="font-mono text-xs text-foreground">
                    [{bin.bin_start.toFixed(1)}, {bin.bin_end.toFixed(1)})
                  </td>
                  <td className="text-foreground">{bin.count}</td>
                  <td className="font-mono text-xs text-muted">{bin.avg_predicted_p.toFixed(4)}</td>
                  <td className="font-mono text-xs text-muted">{bin.empirical_frequency.toFixed(4)}</td>
                  <td className="font-mono text-xs text-muted">{bin.gap.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
