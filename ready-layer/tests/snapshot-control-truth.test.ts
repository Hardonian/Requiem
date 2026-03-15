import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const pagePath = path.join(repoRoot, 'src/app/console/snapshots/page.tsx');

describe('console snapshots action-truth semantics', () => {
  const source = fs.readFileSync(pagePath, 'utf-8');

  it('guards restore mutation when route maturity is demo-backed', () => {
    expect(source).toContain("const restoreRuntimeAvailable = routeMaturity.maturity === 'runtime-backed';");
    expect(source).toContain('if (!restoreRuntimeAvailable)');
    expect(source).toContain('does not perform runtime rollback mutations');
  });

  it('renders explicit unavailable action copy for disabled restore controls', () => {
    expect(source).toContain('Restore unavailable');
    expect(source).toContain('Demo route: rollback mutation disabled.');
  });
});
