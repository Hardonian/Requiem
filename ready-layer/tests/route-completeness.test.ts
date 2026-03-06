import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(process.cwd(), 'src/app');

const intendedRoutes = [
  '/', '/docs', '/documentation', '/pricing', '/login', '/signup', '/auth/signin', '/auth/signup', '/app', '/console', '/runs', '/status', '/changelog', '/privacy', '/terms',
  '/console/overview', '/console/runs', '/console/policies', '/console/logs', '/console/plans', '/console/capabilities', '/console/finops', '/console/snapshots', '/registry', '/spend', '/drift', '/settings',
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

  it('console navigation links target implemented pages', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ConsoleNavigation.tsx'), 'utf8');
    const matches = [...source.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
    for (const href of matches) {
      expect(routeExists(href), `${href} is missing`).toBe(true);
    }
  });
});
