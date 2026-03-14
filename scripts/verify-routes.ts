#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { generateRouteManifest, readRouteManifest, type ManifestRoute } from './lib/route-manifest';

const ROOT_DIR = process.cwd();
const MANIFEST_PATH = path.join(ROOT_DIR, 'routes.manifest.json');
const API_DIR = path.join(ROOT_DIR, 'ready-layer/src/app/api');

const EXPLICIT_WRAPPER_EXCEPTIONS = new Set([
  '/api/status',
  '/api/mcp/health',
  '/api/mcp/tools',
  '/api/mcp/tool/call',
]);

function walkApiRoutes(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkApiRoutes(full));
    else if (entry.isFile() && entry.name === 'route.ts') out.push(full);
  }
  return out;
}

function routePathFromFile(file: string): string {
  const rel = path.relative(API_DIR, path.dirname(file)).replace(/\\/g, '/');
  return rel ? `/api/${rel}` : '/api';
}

function routeUsesTenantContext(file: string): boolean {
  const source = fs.readFileSync(file, 'utf8');
  return source.includes('withTenantContext(') && source.includes("@/lib/big4-http");
}

function key(route: Pick<ManifestRoute, 'path' | 'method'>): string {
  return `${route.method} ${route.path}`;
}

async function main() {
  const generated = generateRouteManifest(ROOT_DIR);
  const committed = readRouteManifest(MANIFEST_PATH);

  const generatedSet = new Set(generated.routes.map(key));
  const committedSet = new Set(committed.routes.map(key));

  const missingFromManifest = generated.routes.filter((route) => !committedSet.has(key(route)));
  const extraInManifest = committed.routes.filter((route) => !generatedSet.has(key(route)));

  if (missingFromManifest.length > 0 || extraInManifest.length > 0) {
    console.error('Route manifest drift detected. Run: pnpm run verify:release-artifacts && commit routes.manifest.json');
    if (missingFromManifest.length > 0) {
      console.error('Missing from manifest:');
      for (const route of missingFromManifest) console.error(`  - ${key(route)} (${route.file})`);
    }
    if (extraInManifest.length > 0) {
      console.error('Stale in manifest:');
      for (const route of extraInManifest) console.error(`  - ${key(route)} (${route.file})`);
    }
    process.exit(1);
  }

  const wrappersViolations: string[] = [];
  for (const file of walkApiRoutes(API_DIR)) {
    const routePath = routePathFromFile(file);
    if (EXPLICIT_WRAPPER_EXCEPTIONS.has(routePath)) continue;
    if (!routeUsesTenantContext(file)) {
      wrappersViolations.push(`${routePath} (${path.relative(ROOT_DIR, file)})`);
    }
  }

  if (wrappersViolations.length > 0) {
    console.error('Route conformance failure: API routes bypassing withTenantContext');
    wrappersViolations.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }

  console.log(`verify-routes passed (${generated.routes.length} manifest routes, wrapper conformance OK)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
