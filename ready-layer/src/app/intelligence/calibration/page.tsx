import { getCalibration } from '@/lib/intelligence-store';

interface Props {
  searchParams: Promise<{ tenant?: string; claim_type?: string; window?: string }>;
}

export default async function CalibrationPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantId = params.tenant ?? 'public';
  const rows = getCalibration(tenantId, params.claim_type, params.window);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Intelligence / Calibration</h1>
      <p className="text-sm text-slate-600">Tenant: <span className="font-mono">{tenantId}</span></p>
      <p className="text-sm text-slate-600">Window: <span className="font-mono">{params.window ?? "all"}</span></p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Claim</th><th className="text-left py-2">Model</th><th className="text-left py-2">Count</th><th className="text-left py-2">Avg Brier</th><th className="text-left py-2">Sharpness</th>
import Link from 'next/link';
import { loadCalibrationReport } from '@/lib/calibration-report';

export const dynamic = 'force-dynamic';

export default function CalibrationPage() {
  const rows = loadCalibrationReport();

  if (rows.length === 0) {
    return <div className="p-6">Insufficient data (n &lt; threshold)</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Calibration</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">claim_type</th>
            <th className="text-left py-2">model</th>
            <th className="text-left py-2">window</th>
            <th className="text-left py-2">n</th>
            <th className="text-left py-2">avg_brier</th>
            <th className="text-left py-2">ece</th>
            <th className="text-left py-2">mce</th>
            <th className="text-left py-2">sharpness</th>
            <th className="text-left py-2">status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.claim_type}-${row.last_updated_at}`} className="border-b">
              <td className="py-2">{row.claim_type}</td>
              <td className="py-2">{row.model_fingerprint}</td>
              <td className="py-2">{row.count}</td>
              <td className="py-2">{row.avg_brier.toFixed(4)}</td>
              <td className="py-2">{row.sharpness.toFixed(4)}</td>
            <tr key={`${row.claim_type}-${row.model_fingerprint}-${row.window}`} className="border-b">
              <td className="py-2"><Link className="underline" href={`/intelligence/calibration/${row.claim_type}`}>{row.claim_type}</Link></td>
              <td className="py-2">{row.model_fingerprint.slice(0, 16)}</td>
              <td className="py-2">{row.window}</td>
              <td className="py-2">{row.n}</td>
              <td className="py-2">{row.avg_brier.toFixed(4)}</td>
              <td className="py-2">{row.ece.toFixed(4)}</td>
              <td className="py-2">{row.mce.toFixed(4)}</td>
              <td className="py-2">{row.sharpness.toFixed(4)}</td>
              <td className="py-2">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows[0] && (
        <div>
          <h2 className="text-lg font-medium mb-2">Calibration bins ({rows[0].claim_type})</h2>
          <table className="w-full text-xs border-collapse">
            <thead><tr className="border-b"><th className="text-left py-1">Bin</th><th className="text-left py-1">Avg p</th><th className="text-left py-1">Observed</th><th className="text-left py-1">Count</th></tr></thead>
            <tbody>
              {rows[0].bins.map((bin) => (
                <tr key={`${bin.lower}-${bin.upper}`} className="border-b"><td className="py-1">[{bin.lower.toFixed(1)}, {bin.upper.toFixed(1)}]</td><td className="py-1">{bin.avg_predicted.toFixed(3)}</td><td className="py-1">{bin.avg_observed.toFixed(3)}</td><td className="py-1">{bin.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </div>
  );
}
