import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');

describe('console routes consume API envelopes truthfully', () => {
  it('plans page normalizes nested plan envelopes instead of reading non-existent top-level ok fields', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/console/plans/page.tsx'), 'utf-8');
    expect(source).toContain('normalizeEnvelope');
    expect(source).not.toContain('if (data.ok)');
    expect(source).toContain('envelope.data.plans');
  });

  it('snapshots page normalizes nested snapshot envelopes and sends the real restore payload contract', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/console/snapshots/page.tsx'), 'utf-8');
    expect(source).toContain('normalizeEnvelope');
    expect(source).toContain('body: JSON.stringify({ action: "restore", snapshot_hash: hash, force: true })');
    expect(source).not.toContain("fetch(`/api/snapshots?id=${id}`, { method: 'POST' })");
  });
});
