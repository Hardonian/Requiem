#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const NAV_FILE = path.join(ROOT, 'ready-layer/src/lib/console-navigation.ts');
const MATURITY_FILE = path.join(ROOT, 'ready-layer/src/lib/route-maturity.ts');
const DOC_FILE = path.join(ROOT, 'docs/reference/ROUTE_MATURITY.md');
const APP_ROOT = path.join(ROOT, 'ready-layer/src/app');

function pagePathForRoute(route: string): string {
  const normalized = route === '/' ? 'page.tsx' : `${route.replace(/^\//, '')}/page.tsx`;
  return path.join(APP_ROOT, normalized);
}

async function main(): Promise<void> {
  const { CONSOLE_NAV_ENTRIES } = await import(pathToFileURL(NAV_FILE).href) as typeof import('../ready-layer/src/lib/console-navigation');
  const { routeMaturityCatalog } = await import(pathToFileURL(MATURITY_FILE).href) as typeof import('../ready-layer/src/lib/route-maturity');

  const errors: string[] = [];
  const seenRoutes = new Set<string>();
  const catalogByPath = new Map(routeMaturityCatalog.map((route) => [route.path, route]));

  for (const route of routeMaturityCatalog) {
    if (seenRoutes.has(route.path)) {
      errors.push(`duplicate route maturity entry: ${route.path}`);
      continue;
    }
    seenRoutes.add(route.path);

    const pagePath = pagePathForRoute(route.path);
    if (!fs.existsSync(pagePath)) {
      errors.push(`route catalog points to missing page: ${route.path} -> ${path.relative(ROOT, pagePath)}`);
    }

  }

  for (const entry of CONSOLE_NAV_ENTRIES) {
    const route = catalogByPath.get(entry.href);
    if (!route) {
      errors.push(`console nav route missing maturity catalog entry: ${entry.href}`);
      continue;
    }

    if (route.navGroup !== entry.section) {
      errors.push(`${entry.href} nav section mismatch: nav=${entry.section}, catalog=${route.navGroup}`);
    }

    if (route.navLabel !== entry.baseLabel) {
      errors.push(`${entry.href} nav label mismatch: nav="${entry.baseLabel}", catalog="${route.navLabel}"`);
    }
  }

  const docSource = fs.readFileSync(DOC_FILE, 'utf8');
  if (!docSource.includes('ready-layer/src/lib/route-maturity.ts')) {
    errors.push('docs/reference/ROUTE_MATURITY.md must reference ready-layer/src/lib/route-maturity.ts as canonical source');
  }

  if (errors.length > 0) {
    console.error('Route maturity verification failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`verify-route-maturity passed (${routeMaturityCatalog.length} catalog routes, ${CONSOLE_NAV_ENTRIES.length} nav entries)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
