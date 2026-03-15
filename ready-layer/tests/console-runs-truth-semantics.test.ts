import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const runsPagePath = path.join(repoRoot, 'src/app/console/runs/page.tsx');

describe('console runs truth semantics', () => {
  it('uses explicit verification semantics and stable diff query', () => {
    const source = fs.readFileSync(runsPagePath, 'utf-8');

    expect(source).toContain('Verify self-diff');
    expect(source).toContain("semantics=\"runtime-backed\"");
    expect(source).toContain('/api/runs/${runId}/diff?with=${encodeURIComponent(runId)}');
  });

  it('renders distinct degraded runtime states instead of generic empty/error language', () => {
    const source = fs.readFileSync(runsPagePath, 'utf-8');

    expect(source).toContain("'backend-missing'");
    expect(source).toContain("'backend-unreachable'");
    expect(source).toContain("'forbidden'");
    expect(source).toContain('RouteTruthStateCard');
  });
});

