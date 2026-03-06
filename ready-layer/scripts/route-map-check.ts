import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd(), 'src/app');
const navPath = path.resolve(process.cwd(), 'src/components/ConsoleNavigation.tsx');

function routeExists(route: string): boolean {
  if (route === '/') return fs.existsSync(path.join(appRoot, 'page.tsx'));
  return fs.existsSync(path.join(appRoot, route.replace(/^\//, ''), 'page.tsx'));
}

const source = fs.readFileSync(navPath, 'utf8');
const links = [...source.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);

const missing = links.filter((href) => !routeExists(href));
if (missing.length > 0) {
  console.error(`Missing routes for nav links: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Route map OK (${links.length} links checked)`);
