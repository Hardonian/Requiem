import { promises as fs } from 'node:fs';
import path from 'node:path';

type RouteKind = 'page' | 'api';
type RenderMode = 'static-or-isr' | 'dynamic';

type RouteRecord = {
  route: string;
  kind: RouteKind;
  bucket: string;
  source: string;
  dynamicParams: boolean;
  renderMode: RenderMode;
  hasMetadata: boolean;
  hasLoading: boolean;
  hasErrorBoundary: boolean;
  hasNotFoundBoundary: boolean;
};

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'ready-layer', 'src', 'app');
const outDir = path.join(repoRoot, 'reports', 'release-candidate');
const jsonOut = path.join(outDir, 'ROUTE_TRUTH_MATRIX.json');
const mdOut = path.join(outDir, 'ROUTE_TRUTH_MATRIX.md');

function toRoute(relativeDir: string): string {
  if (!relativeDir || relativeDir === '.') return '/';
  const segments = relativeDir
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !segment.startsWith('('))
    .filter((segment) => !segment.startsWith('@'));
  const normalized = segments.join('/');
  return normalized ? `/${normalized}` : '/';
}

function bucketFor(route: string, kind: RouteKind): string {
  if (kind === 'api') return route.startsWith('/api/health') || route.startsWith('/api/status') ? 'api/health/status' : 'api/internal';
  if (route === '/' || route.startsWith('/pricing') || route.startsWith('/enterprise') || route.startsWith('/security') || route.startsWith('/privacy') || route.startsWith('/terms')) return 'marketing/static';
  if (route.startsWith('/docs') || route.startsWith('/documentation') || route.startsWith('/library') || route.startsWith('/changelog')) return 'docs/help';
  if (route.startsWith('/auth') || route.startsWith('/login') || route.startsWith('/signup')) return 'auth/account';
  if (route.startsWith('/console') || route.startsWith('/app') || route.startsWith('/settings')) return 'app/dashboard';
  if (route.startsWith('/demo') || route.startsWith('/proof')) return 'playground/demo';
  if (route.includes('[')) return 'dynamic entity route';
  return 'other';
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function hasAny(files: string[], suffixes: string[]): boolean {
  return files.some((file) => suffixes.some((suffix) => file.endsWith(suffix)));
}

async function main() {
  const files = await walk(appRoot);
  const pageFiles = files.filter((f) => /\/page\.(tsx|ts|jsx|js)$/.test(f));
  const apiFiles = files.filter((f) => /\/route\.(tsx|ts|jsx|js)$/.test(f));

  const records: RouteRecord[] = [];

  for (const file of pageFiles) {
    const dir = path.dirname(file);
    const relDir = path.relative(appRoot, dir);
    const route = toRoute(relDir);
    const siblingFiles = files.filter((candidate) => path.dirname(candidate) === dir).map((candidate) => path.basename(candidate));
    records.push({
      route,
      kind: 'page',
      bucket: bucketFor(route, 'page'),
      source: path.relative(repoRoot, file),
      dynamicParams: route.includes('['),
      renderMode: hasAny(siblingFiles, ['dynamic.ts', 'route.ts']) ? 'dynamic' : 'static-or-isr',
      hasMetadata: hasAny(siblingFiles, ['page.tsx', 'page.ts']) || hasAny(siblingFiles, ['metadata.ts']),
      hasLoading: hasAny(siblingFiles, ['loading.tsx', 'loading.ts']),
      hasErrorBoundary: hasAny(siblingFiles, ['error.tsx', 'error.ts']),
      hasNotFoundBoundary: hasAny(siblingFiles, ['not-found.tsx', 'not-found.ts'])
    });
  }

  for (const file of apiFiles) {
    const dir = path.dirname(file);
    const relDir = path.relative(appRoot, dir);
    const route = toRoute(relDir);
    records.push({
      route,
      kind: 'api',
      bucket: bucketFor(route, 'api'),
      source: path.relative(repoRoot, file),
      dynamicParams: route.includes('['),
      renderMode: 'dynamic',
      hasMetadata: false,
      hasLoading: false,
      hasErrorBoundary: false,
      hasNotFoundBoundary: false
    });
  }

  records.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));

  await fs.mkdir(outDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRoutes: records.length,
      pageRoutes: records.filter((r) => r.kind === 'page').length,
      apiRoutes: records.filter((r) => r.kind === 'api').length,
      dynamicRoutes: records.filter((r) => r.dynamicParams).length
    },
    routes: records
  };

  const header = `# Route Truth Matrix\n\nGenerated: ${payload.generatedAt}\n\n- Total routes: **${payload.summary.totalRoutes}**\n- Page routes: **${payload.summary.pageRoutes}**\n- API routes: **${payload.summary.apiRoutes}**\n- Dynamic param routes: **${payload.summary.dynamicRoutes}**\n\n| Route | Kind | Bucket | Dynamic Params | Render Mode | Loading | Error Boundary | Not Found Boundary | Source |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;

  const rows = records
    .map((r) => `| \`${r.route}\` | ${r.kind} | ${r.bucket} | ${r.dynamicParams ? 'yes' : 'no'} | ${r.renderMode} | ${r.hasLoading ? 'yes' : 'no'} | ${r.hasErrorBoundary ? 'yes' : 'no'} | ${r.hasNotFoundBoundary ? 'yes' : 'no'} | \`${r.source}\` |`)
    .join('\n');

  await fs.writeFile(jsonOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdOut, `${header}${rows}\n`, 'utf8');

  console.log(`Wrote ${path.relative(repoRoot, jsonOut)} and ${path.relative(repoRoot, mdOut)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
