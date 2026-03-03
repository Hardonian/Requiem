import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDir = process.env.REQUIEM_INTELLIGENCE_STORE_DIR;

afterEach(() => {
  vi.resetModules();
  if (originalDir === undefined) {
    delete process.env.REQUIEM_INTELLIGENCE_STORE_DIR;
  } else {
    process.env.REQUIEM_INTELLIGENCE_STORE_DIR = originalDir;
  }
});

describe('intelligence-store calibration window filtering', () => {
  it('filters calibration aggregates by requested window', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'intelligence-window-'));
    process.env.REQUIEM_INTELLIGENCE_STORE_DIR = tmp;

    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

    const rows = [
      {
        tenant_id: 'tenant-a',
        model_fingerprint: 'm1',
        promptset_version: 'v1',
        claim_type: 'TESTS_PASS',
        count: 10,
        avg_brier: 0.1,
        sharpness: 0.2,
        bins: [],
        last_updated_at: recent,
        calibration_version: 'v1',
      },
      {
        tenant_id: 'tenant-a',
        model_fingerprint: 'm1',
        promptset_version: 'v1',
        claim_type: 'TESTS_PASS',
        count: 9,
        avg_brier: 0.2,
        sharpness: 0.3,
        bins: [],
        last_updated_at: old,
        calibration_version: 'v1',
      },
    ];

    fs.writeFileSync(path.join(tmp, 'calibration.ndjson'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const mod = await import('../src/lib/intelligence-store');
    const thirtyDays = mod.getCalibration('tenant-a', 'TESTS_PASS', '30d');
    const seventyTwoHours = mod.getCalibration('tenant-a', 'TESTS_PASS', '72h');

    expect(thirtyDays).toHaveLength(1);
    expect(seventyTwoHours).toHaveLength(1);
    expect(thirtyDays[0].last_updated_at).toBe(recent);
  });
});
