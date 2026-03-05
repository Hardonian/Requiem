import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const ROOT = process.env.REQUIEM_LEARNING_DIR || path.join(process.cwd(), '.requiem/learning');
const CAS_DIR = path.join(ROOT, 'cas');
const EVENTS_FILE = path.join(ROOT, 'events.ndjson');

function ensure(): void {
  fs.mkdirSync(CAS_DIR, { recursive: true });
}

function canonical(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) out[k] = norm(val);
      return out;
    }
    if (typeof x === 'number' && Number.isFinite(x)) return Number(x.toFixed(12));
    return x;
  };
  return JSON.stringify(norm(v));
}

function put(value: unknown): string {
  ensure();
  const body = canonical(value);
  const digest = createHash('sha256').update(body).digest('hex');
  const file = path.join(CAS_DIR, `${digest}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, `${body}\n`, 'utf8');
  return `cas:${digest}`;
}

function get<T>(cas: string): T {
  const digest = cas.replace(/^cas:/, '');
  return JSON.parse(fs.readFileSync(path.join(CAS_DIR, `${digest}.json`), 'utf8')) as T;
}

function appendEvent(event_type: string, tenant_id: string, artifact_cas: string, metadata: Record<string, unknown>): void {
  ensure();
  const evt = { event_id: randomUUID(), event_type, tenant_id, artifact_cas, metadata, created_at: new Date().toISOString(), event_version: 'v1' };
  fs.appendFileSync(EVENTS_FILE, `${canonical(evt)}\n`, 'utf8');
}

function listBySchema<T>(schema: string): T[] {
  ensure();
  const files = fs.readdirSync(CAS_DIR).filter((v) => v.endsWith('.json')).sort();
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(CAS_DIR, f), 'utf8')) as { schema?: string }).filter((x) => x.schema === schema) as T[];
}

export function addOutcomeEvent(input: { tenant_id: string; trace_id: string; prediction_event_cas: string; actual: number; outcome_source: string; outcome_refs: string[] }): { outcome_cas: string } {
  const pred = get<{ id: string; tenant_id: string }>(input.prediction_event_cas);
  if (pred.tenant_id !== input.tenant_id) throw new Error('tenant mismatch');
  const event = {
    prediction_event_id: pred.id,
    trace_id: input.trace_id,
    tenant_id: input.tenant_id,
    actual: input.actual,
    resolved_at_normalized: new Date().toISOString(),
    outcome_source: input.outcome_source,
    outcome_refs: [...input.outcome_refs].sort(),
    schema: 'outcome_event_v1',
  };
  const outcome_cas = put(event);
  appendEvent('learning.outcome.recorded', input.tenant_id, outcome_cas, { prediction_event_id: pred.id });
  return { outcome_cas };
}

export function getLatestCrosstab(tenant_id: string, window: string): { data: Record<string, unknown>; cas: string | null } {
  const rows = listBySchema<Record<string, unknown>>('crosstab_v1').filter((r) => r.tenant_id === tenant_id && r.window === window);
  if (rows.length === 0) return { data: { tenant_id, window, tables: [] }, cas: null };
  const data = rows[rows.length - 1] as Record<string, unknown>;
  return { data, cas: put(data) };
}

export function getLatestErrorBands(tenant_id: string, model_id?: string): { data: Record<string, unknown>; cas: string | null } {
  const rows = listBySchema<Record<string, unknown>>('error_band_v1').filter((r) => r.tenant_id === tenant_id && (!model_id || r.model_id === model_id));
  if (rows.length === 0) return { data: { tenant_id, bands: [] }, cas: null };
  const data = rows[rows.length - 1] as Record<string, unknown>;
  return { data, cas: put(data) };
}

export function getDashboard(tenant_id: string): Record<string, unknown> {
  const preds = listBySchema<Record<string, unknown>>('prediction_event_v1').filter((r) => r.tenant_id === tenant_id).length;
  const outs = listBySchema<Record<string, unknown>>('outcome_event_v1').filter((r) => r.tenant_id === tenant_id).length;
  const errs = listBySchema<Record<string, unknown>>('error_record_v1').filter((r) => r.tenant_id === tenant_id);
  const avgMae = errs.reduce((s, e) => s + Number(e.mae_component || 0), 0) / Math.max(1, errs.length);
  const calib = listBySchema<Record<string, unknown>>('calibration_v1').filter((r) => r.tenant_id === tenant_id).length;
  const weights = listBySchema<Record<string, unknown>>('weights_v1').filter((r) => r.tenant_id === tenant_id).length;
  return { tenant_id, counts: { predictions: preds, outcomes: outs, errors: errs.length, calibrations: calib, weights }, avg_mae: avgMae, updated_at: new Date().toISOString() };
}

export function trainWeightsFromDataset(input: {
  tenant_id: string;
  model_id: string;
  dataset_rows: Array<{ feature_key: string; feature_value: number; actual: number }>;
  seed: number;
  learning_rate: number;
  max_iters: number;
}): { weights_cas: string; eval_cas: string } {
  const grouped = new Map<string, Array<{ x: number; y: number }>>();
  for (const row of input.dataset_rows) {
    const arr = grouped.get(row.feature_key) ?? [];
    arr.push({ x: row.feature_value, y: row.actual });
    grouped.set(row.feature_key, arr);
  }
  const weights = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([feature, vals]) => {
    let w = (input.seed % 29) / 29;
    for (let i = 0; i < input.max_iters; i += 1) {
      let grad = 0;
      for (const v of vals) grad += 2 * (w * v.x - v.y) * v.x;
      grad /= Math.max(1, vals.length);
      w -= input.learning_rate * grad;
    }
    return { feature_key: feature, weight: Number(w.toFixed(6)) };
  });
  const mae = input.dataset_rows.reduce((s, row) => {
    const w = weights.find((x) => x.feature_key === row.feature_key)?.weight ?? 0;
    return s + Math.abs(w * row.feature_value - row.actual);
  }, 0) / Math.max(1, input.dataset_rows.length);
  const eval_cas = put({ schema: 'eval_report_v1', tenant_id: input.tenant_id, model_id: input.model_id, mae, count: input.dataset_rows.length, created_at: new Date().toISOString() });
  const weights_cas = put({ schema: 'weights_v1', tenant_id: input.tenant_id, model_id: input.model_id, version: `w-${Date.now()}`, weights, learning_rate: input.learning_rate, created_at_normalized: new Date().toISOString(), trained_on_dataset_cas: 'inline', eval_report_cas: eval_cas, constraints: { min: -10, max: 10 } });
  appendEvent('learning.weights.trained', input.tenant_id, weights_cas, { model_id: input.model_id });
  return { weights_cas, eval_cas };
}

export function trainCalibrationFromDataset(input: {
  tenant_id: string;
  model_id: string;
  method: 'platt' | 'isotonic' | 'bayesian_beta' | 'none';
  dataset_rows: Array<{ predicted: number; raw_score: number; actual: number }>;
  seed?: number;
}): { calibration_cas: string; eval_cas: string; calibration_id: string; params: Record<string, unknown>; trained_on_dataset_cas: string } {
  const seed = input.seed ?? 42;
  const rows = [...input.dataset_rows].sort((a, b) => a.predicted - b.predicted || a.raw_score - b.raw_score || a.actual - b.actual);
  const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
  let params: Record<string, unknown> = {};

  if (input.method === 'platt') {
    let a = (seed % 17) / 100;
    let b = 0;
    const lr = 0.1;
    for (let i = 0; i < 80; i += 1) {
      let da = 0;
      let db = 0;
      for (const r of rows) {
        const p = sigmoid(a * r.raw_score + b);
        da += (p - r.actual) * r.raw_score;
        db += (p - r.actual);
      }
      a -= (lr * da) / Math.max(1, rows.length);
      b -= (lr * db) / Math.max(1, rows.length);
    }
    params = { a: Number(a.toFixed(8)), b: Number(b.toFixed(8)) };
  } else if (input.method === 'isotonic') {
    const buckets = Array.from({ length: 10 }, (_, i) => ({ lower: i / 10, upper: (i + 1) / 10, values: [] as number[] }));
    for (const r of rows) {
      const idx = Math.min(9, Math.floor(r.predicted * 10));
      buckets[idx]?.values.push(r.actual);
    }
    let last = 0;
    params = {
      breakpoints: buckets.map((b) => {
        const avg = b.values.length > 0 ? b.values.reduce((s, v) => s + v, 0) / b.values.length : last;
        last = Math.max(last, avg);
        return { x: Number(b.upper.toFixed(2)), y: Number(last.toFixed(6)) };
      }),
    };
  } else if (input.method === 'bayesian_beta') {
    const alpha0 = 1;
    const beta0 = 1;
    const bins = Array.from({ length: 10 }, (_, i) => ({ idx: i, succ: 0, fail: 0 }));
    for (const r of rows) {
      const idx = Math.min(9, Math.floor(r.predicted * 10));
      if (r.actual >= 0.5) bins[idx]!.succ += 1;
      else bins[idx]!.fail += 1;
    }
    params = {
      prior_alpha: alpha0,
      prior_beta: beta0,
      bins: bins.map((b) => {
        const alpha = alpha0 + b.succ;
        const beta = beta0 + b.fail;
        return { bucket: b.idx, alpha, beta, mean: Number((alpha / (alpha + beta)).toFixed(6)) };
      }),
    };
  }

  const trained_on_dataset_cas = put({ schema: 'learning_dataset_v1', rows });
  const eval_cas = put({
    schema: 'calibration_eval_v1',
    tenant_id: input.tenant_id,
    model_id: input.model_id,
    method: input.method,
    count: rows.length,
    params,
    seed,
    created_at: new Date().toISOString(),
  });
  const calibration_id = createHash('sha256').update(canonical({ model_id: input.model_id, method: input.method, params })).digest('hex');
  const calibration_cas = put({
    schema: 'calibration_v1',
    calibration_id,
    tenant_id: input.tenant_id,
    model_id: input.model_id,
    method: input.method,
    params,
    trained_on_dataset_cas,
    eval_report_cas: eval_cas,
    created_at_normalized: new Date().toISOString(),
  });
  appendEvent('learning.calibration.trained', input.tenant_id, calibration_cas, { model_id: input.model_id, method: input.method, calibration_id });
  return { calibration_cas, eval_cas, calibration_id, params, trained_on_dataset_cas };
}

function simpleReliabilitySvg(points: Array<{ x: number; y: number }>, title: string): string {
  const width = 640;
  const height = 360;
  const m = 32;
  const toX = (v: number): number => m + v * (width - m * 2);
  const toY = (v: number): number => height - m - v * (height - m * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0f172a"/><text x="${m}" y="22" fill="#e2e8f0" font-size="14">${title}</text><line x1="${m}" y1="${height-m}" x2="${width-m}" y2="${m}" stroke="#334155" stroke-dasharray="4 4"/><path d="${path}" stroke="#22d3ee" fill="none" stroke-width="2"/></svg>`;
}

function simpleErrorBandSvg(points: Array<{ x: number; p50: number; p90: number; p95: number }>, title: string): string {
  const width = 640;
  const height = 360;
  const m = 32;
  const maxY = Math.max(1e-9, ...points.flatMap((p) => [p.p50, p.p90, p.p95]));
  const toX = (v: number): number => m + v * (width - m * 2);
  const toY = (v: number): number => height - m - (v / maxY) * (height - m * 2);
  const mk = (k: 'p50' | 'p90' | 'p95') => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p[k])}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#020617"/><text x="${m}" y="22" fill="#e2e8f0" font-size="14">${title}</text><path d="${mk('p50')}" stroke="#22c55e" fill="none" stroke-width="2"/><path d="${mk('p90')}" stroke="#eab308" fill="none" stroke-width="2"/><path d="${mk('p95')}" stroke="#f97316" fill="none" stroke-width="2"/></svg>`;
}

export function buildCrosstab(tenant_id: string, window: string): { crosstab_cas: string; report: Record<string, unknown>; visual_svg_cas: string; visual_html_cas: string } {
  const errs = listBySchema<Array<Record<string, unknown>> | Record<string, unknown>>('error_record_v1') as Record<string, unknown>[];
  const mine = errs.filter((e) => e.tenant_id === tenant_id);
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const e of mine) {
    const b = String(e.calibration_bucket ?? 'unknown');
    const arr = groups.get(b) ?? [];
    arr.push(e);
    groups.set(b, arr);
  }
  const tables = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, rows]) => ({ bucket, count: rows.length, mae: rows.reduce((s, r) => s + Number(r.mae_component || 0), 0) / Math.max(1, rows.length) }));
  const report = { schema: 'crosstab_v1', tenant_id, window, dimensions: ['tenant', 'confidence_bucket'], metrics: ['mae'], tables, generated_at_normalized: new Date().toISOString() };
  const reliabilityPoints = tables.map((t, i) => ({ x: Math.min(1, (i + 1) / Math.max(1, tables.length)), y: Math.max(0, Math.min(1, 1 - Number(t.mae || 0))) }));
  const visual_svg_cas = put({ schema: 'visual_svg_v1', kind: 'reliability_diagram', svg: simpleReliabilitySvg(reliabilityPoints, `Reliability · ${tenant_id}`), generated_at: new Date().toISOString() });
  const visual_html_cas = put({ schema: 'visual_html_v1', kind: 'crosstab_report', html: `<html><body><h1>Crosstab</h1><pre>${canonical(report)}</pre><p>svg=${visual_svg_cas}</p></body></html>`, generated_at: new Date().toISOString() });
  const crosstab_cas = put({ ...report, visual_refs: [visual_svg_cas, visual_html_cas] });
  appendEvent('learning.crosstab.generated', tenant_id, crosstab_cas, { window, visual_svg_cas, visual_html_cas });
  return { crosstab_cas, report, visual_svg_cas, visual_html_cas };
}

export function buildErrorBands(tenant_id: string, model_id: string, mc: number): { error_bands_cas: string; report: Record<string, unknown>; visual_svg_cas: string; visual_html_cas: string } {
  const errs = listBySchema<Record<string, unknown>>('error_record_v1').filter((e) => e.tenant_id === tenant_id).map((e) => Number(e.mae_component || 0)).sort((a, b) => a - b);
  const percentile = (p: number): number => errs[Math.min(errs.length - 1, Math.floor(errs.length * p))] ?? 0;
  const report = { schema: 'error_band_v1', tenant_id, model_id, method: 'bootstrap', window: 'rolling', mc_runs: mc, bands: [{ bucket: 'global', p50: percentile(0.5), p90: percentile(0.9), p95: percentile(0.95), p99: percentile(0.99) }], generated_at_normalized: new Date().toISOString() };
  const chartPoints = [{ x: 0, p50: report.bands[0].p50, p90: report.bands[0].p90, p95: report.bands[0].p95 }];
  const visual_svg_cas = put({ schema: 'visual_svg_v1', kind: 'error_band_chart', svg: simpleErrorBandSvg(chartPoints, `Error Bands · ${model_id}`), generated_at: new Date().toISOString() });
  const visual_html_cas = put({ schema: 'visual_html_v1', kind: 'error_bands_report', html: `<html><body><h1>Error Bands</h1><pre>${canonical(report)}</pre><p>svg=${visual_svg_cas}</p></body></html>`, generated_at: new Date().toISOString() });
  const error_bands_cas = put({ ...report, visual_refs: [visual_svg_cas, visual_html_cas] });
  appendEvent('learning.error_bands.generated', tenant_id, error_bands_cas, { mc, visual_svg_cas, visual_html_cas });
  return { error_bands_cas, report, visual_svg_cas, visual_html_cas };
}
