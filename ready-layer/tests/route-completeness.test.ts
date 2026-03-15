import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { routeMaturityCatalog } from '../src/lib/route-maturity';

const appRoot = path.resolve(process.cwd(), 'src/app');

const intendedRoutes = [
  '/', '/docs', '/documentation', '/pricing', '/login', '/signup', '/auth/signin', '/auth/signup',
  '/app', '/app/executions', '/app/semantic-ledger', '/app/replay', '/app/cas', '/app/policy', '/app/audit', '/app/metrics', '/app/diagnostics', '/app/interop', '/app/tenants',
  '/console', '/console/overview', '/console/runs', '/console/policies', '/console/logs', '/console/plans', '/console/capabilities', '/console/finops', '/console/snapshots', '/console/objects', '/console/decisions', '/console/architecture', '/console/guarantees', '/console/replication',
  '/intelligence/learning', '/intelligence/signals', '/intelligence/cases', '/intelligence/verification', '/intelligence/calibration', '/intelligence/foundry',
  '/runs', '/status', '/changelog', '/privacy', '/terms', '/registry', '/spend', '/drift', '/settings',
];

function routeExists(route: string): boolean {
  if (route === '/') {
    return fs.existsSync(path.join(appRoot, 'page.tsx'));
  }
  const routePath = route.replace(/^\//, '');
  return fs.existsSync(path.join(appRoot, routePath, 'page.tsx'));
}

describe('route completeness', () => {
  for (const route of intendedRoutes) {
    it(`${route} has an app route implementation`, () => {
      expect(routeExists(route)).toBe(true);
    });
  }

  it('maturity catalog routes target implemented pages', () => {
    for (const entry of routeMaturityCatalog) {
      expect(routeExists(entry.path), `${entry.path} is missing`).toBe(true);
    }
  });
});
