import fs from 'node:fs';
import path from 'node:path';
import { routeMaturityCatalog } from '../src/lib/route-maturity';

const appRoot = path.resolve(process.cwd(), 'src/app');

function routeExists(route: string): boolean {
  if (route === '/') return fs.existsSync(path.join(appRoot, 'page.tsx'));
  return fs.existsSync(path.join(appRoot, route.replace(/^\//, ''), 'page.tsx'));
}

const missing = routeMaturityCatalog.map((entry) => entry.path).filter((href) => !routeExists(href));
if (missing.length > 0) {
  console.error(`Missing routes for maturity catalog links: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Route map OK (${routeMaturityCatalog.length} catalog links checked)`);
