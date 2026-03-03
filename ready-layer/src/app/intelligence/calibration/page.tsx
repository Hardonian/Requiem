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
    </div>
  );
}
