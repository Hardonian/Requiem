import fs from 'node:fs';
import path from 'node:path';
import { routeMaturityCatalog } from '../src/lib/route-maturity';

const appRoot = path.resolve(process.cwd(), 'src/app');

function pageExists(route: string): boolean {
  const normalized = route === '/' ? 'page.tsx' : `${route.replace(/^\//, '')}/page.tsx`;
  return fs.existsSync(path.join(appRoot, normalized));
}

function main(): void {
  const seen = new Set<string>();
  const problems: string[] = [];

  for (const route of routeMaturityCatalog) {
    if (seen.has(route.path)) {
      problems.push(`duplicate route entry: ${route.path}`);
    }
    seen.add(route.path);

    if (!pageExists(route.path)) {
      problems.push(`route catalog points to missing page: ${route.path}`);
    }

    if (route.disclosureRequired) {
      const pagePath = path.join(appRoot, route.path.replace(/^\//, ''), 'page.tsx');
      const source = fs.readFileSync(pagePath, 'utf8');
      if (!source.includes('RouteMaturityNote')) {
        problems.push(`${route.path} requires disclosure but does not render RouteMaturityNote`);
      }
    }

    if (route.maturity === 'demo' && route.navStatus !== 'demo') {
      problems.push(`${route.path} is demo maturity but navStatus=${route.navStatus}`);
    }

    if (route.maturity === 'informational' && route.ctaRestriction === 'none') {
      problems.push(`${route.path} informational routes cannot have unrestricted CTAs`);
    }
  }

  if (problems.length > 0) {
    console.error('Route maturity verification failed:');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  console.log(`route maturity verification passed (${routeMaturityCatalog.length} catalog routes)`);
}

main();
