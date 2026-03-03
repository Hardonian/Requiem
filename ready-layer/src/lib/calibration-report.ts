import fs from 'node:fs';
import path from 'node:path';

export interface CalibrationReportRow {
  tenant_id: string;
  claim_type: string;
  model_fingerprint: string;
  promptset_version: string;
  window: string;
  n: number;
  avg_brier: number;
  ece: number;
  mce: number;
  sharpness: number;
  status: string;
  bins: Array<{
    bin_index: number;
    bin_start: number;
    bin_end: number;
    count: number;
    avg_predicted_p: number;
    empirical_frequency: number;
    gap: number;
  }>;
}

export function loadCalibrationReport(): CalibrationReportRow[] {
  const reportPath = path.join(process.cwd(), 'artifacts', 'calibration', 'calibration_report.json');
  if (!fs.existsSync(reportPath)) return [];
  const raw = fs.readFileSync(reportPath, 'utf8');
  return JSON.parse(raw) as CalibrationReportRow[];
}
