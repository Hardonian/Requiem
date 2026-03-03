import { CalibrationRepository } from '../db/decisions.js';

interface CalibrationArgs {
  command: 'compute' | 'show';
  tenantId?: string;
  window: '7d' | '30d' | 'all';
  json: boolean;
}

export function parseCalibrationArgs(argv: string[]): CalibrationArgs {
  const args: CalibrationArgs = { command: 'show', window: '30d', json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === 'compute') args.command = 'compute';
    else if (arg === 'show') args.command = 'show';
    else if (arg === '--tenant' && next) {
      args.tenantId = next;
      i++;
    } else if (arg === '--window' && next && (next === '7d' || next === '30d' || next === 'all')) {
      args.window = next;
      i++;
    } else if (arg === '--json') args.json = true;
  }
  return args;
}

export async function runCalibrationCommand(argv: string[]): Promise<number> {
  const parsed = parseCalibrationArgs(argv);
  const { requireTenantContextCli, getGlobalTenantResolver } = await import('../lib/tenant.js');
  const ctx = await requireTenantContextCli(getGlobalTenantResolver(), {
    ...process.env,
    REQUIEM_TENANT_ID: parsed.tenantId || process.env.REQUIEM_TENANT_ID,
  });

  if (parsed.command === 'compute') {
    const count = CalibrationRepository.computeAndStoreMetrics(ctx.tenantId, parsed.window);
    if (parsed.json) {
      console.log(JSON.stringify({ ok: true, tenant_id: ctx.tenantId, window: parsed.window, groups: count }, null, 2));
    } else {
      console.log(`Computed calibration metrics for ${count} claim/model groups (${parsed.window}).`);
    }
    return 0;
  }

  const rows = CalibrationRepository.latestMetrics(ctx.tenantId) as Array<Record<string, unknown>>;
  if (parsed.json) {
    console.log(JSON.stringify({ ok: true, tenant_id: ctx.tenantId, data: rows }, null, 2));
  } else if (rows.length === 0) {
    console.log('No calibration metrics yet. Run: reach calibration compute --window 30d');
  } else {
    console.log('claim_type | model | window | n | avg_brier | ece | mce | sharpness | status');
    for (const row of rows) {
      console.log(`${row.claim_type} | ${String(row.model_fingerprint).slice(0, 12)} | ${row.time_window} | ${row.sample_size} | ${row.avg_brier} | ${row.ece} | ${row.mce} | ${row.sharpness} | ${row.status}`);
    }
  }
  return 0;
}
