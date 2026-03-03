import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');

const consolePages = [
  'src/app/console/logs/page.tsx',
  'src/app/console/runs/page.tsx',
  'src/app/console/plans/page.tsx',
  'src/app/console/policies/page.tsx',
  'src/app/console/capabilities/page.tsx',
  'src/app/console/finops/page.tsx',
  'src/app/console/snapshots/page.tsx'
];

const apiRoutes = [
  'src/app/api/logs/route.ts',
  'src/app/api/runs/route.ts',
  'src/app/api/plans/route.ts',
  'src/app/api/policies/route.ts',
  'src/app/api/caps/route.ts',
  'src/app/api/budgets/route.ts',
  'src/app/api/snapshots/route.ts'
];

describe('Console Route Smoke', () => {
  for (const relPath of consolePages) {
    it(`${relPath} exists and has content`, () => {
      const absPath = path.join(repoRoot, relPath);
      expect(fs.existsSync(absPath)).toBe(true);
      const source = fs.readFileSync(absPath, 'utf-8');
      expect(source.trim().length).toBeGreaterThan(0);
    });
  }
});

describe('API Route Smoke', () => {
  for (const relPath of apiRoutes) {
    it(`${relPath} exports an HTTP handler`, () => {
      const absPath = path.join(repoRoot, relPath);
      expect(fs.existsSync(absPath)).toBe(true);
      const source = fs.readFileSync(absPath, 'utf-8');
      expect(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(source)).toBe(
        true
      );
    });
  }
});
