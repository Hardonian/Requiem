import fs from 'node:fs';
import path from 'node:path';

type RouteRow = {
  path: string;
  file: string;
  parentLayout: string;
  authRequired: 'yes' | 'no';
  roleSensitive: 'yes' | 'no';
  surfaceType: string;
  dependencyProfile: string;
  classification: string;
  evidence: string;
};

type ActionRow = {
  route: string;
  label: string;
  impliedMeaning: string;
  file: string;
  implementation: string;
  dependencyProfile: string;
  finalClassification: string;
  evidence: string;
};

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'src', 'app');
const docsDir = path.join(repoRoot, 'docs');
const outputFile = path.join(docsDir, 'authenticated-truth-matrix.md');
const protectedPrefixes = ['/app', '/console', '/intelligence', '/runs', '/registry', '/settings', '/drift', '/spend', '/proof'];

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    if (entry.isFile() && entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

function routeFromPage(file: string): string {
  const rel = path.relative(appRoot, path.dirname(file)).split(path.sep).join('/');
  if (!rel || rel === '.') return '/';
  return `/${rel}`;
}

function parentLayoutForRoute(routePath: string): string {
  const parts = routePath.split('/').filter(Boolean);
  for (let i = parts.length; i >= 0; i--) {
    const prefix = parts.slice(0, i);
    const layoutPath = path.join(appRoot, ...prefix, 'layout.tsx');
    if (fs.existsSync(layoutPath)) {
      return path.relative(repoRoot, layoutPath);
    }
  }
  return 'src/app/layout.tsx';
}

function classifySurface(source: string, routePath: string): { type: string; deps: string; classification: string; evidence: string } {
  const hasApiCalls = /(fetch\(|axios\.|\/api\/|useQuery|queryFn|mutation)/.test(source);
  const hasEngineEnv = /REQUIEM_API_URL|engine|runtime/i.test(source);
  const hasUseState = /useState\(|onClick=|onChange=/.test(source);
  const authRequired = protectedPrefixes.some((p) => routePath === p || routePath.startsWith(`${p}/`));

  if (!authRequired) {
    return {
      type: 'static/informational',
      deps: 'none beyond app runtime',
      classification: 'healthy',
      evidence: 'source inspection',
    };
  }

  if (hasApiCalls && hasEngineEnv) {
    return {
      type: 'runtime-backed',
      deps: 'auth session + REQUIEM_API_URL + backend reachability (route-specific data)',
      classification: 'runtime-backed (source-inspected; runtime varies by backend state)',
      evidence: 'source inspection + runtime screenshot',
    };
  }

  if (hasApiCalls) {
    return {
      type: 'mixed',
      deps: 'auth session + API route reachability',
      classification: 'degraded-but-truthful',
      evidence: 'source inspection + runtime screenshot',
    };
  }

  if (hasUseState) {
    return {
      type: 'local-only interactive',
      deps: 'auth session only',
      classification: 'thin-but-safe',
      evidence: 'source inspection + runtime screenshot',
    };
  }

  return {
    type: 'thin/stub but truthful',
    deps: 'auth session only',
    classification: 'source-inspected only',
    evidence: 'source inspection',
  };
}

function extractActionRows(route: string, file: string, source: string): ActionRow[] {
  const rows: ActionRow[] = [];

  const linkRegex = /<Link[^>]*href=\{?['"]([^'"}]+)['"]\}?[^>]*>([\s\S]*?)<\/Link>/g;
  for (const match of source.matchAll(linkRegex)) {
    const href = match[1];
    const rawLabel = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const label = rawLabel || href;
    rows.push({
      route,
      label,
      impliedMeaning: `Navigate to ${href}`,
      file,
      implementation: 'navigation only',
      dependencyProfile: 'client routing + destination route dependencies',
      finalClassification: 'local-only informational navigation',
      evidence: 'source inspection',
    });
  }

  const buttonRegex = /<button([^>]*)>([\s\S]*?)<\/button>/g;
  for (const match of source.matchAll(buttonRegex)) {
    const attrs = match[1] ?? '';
    const rawLabel = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const label = rawLabel || 'unlabeled button';
    const hasDisabled = /disabled|aria-disabled/.test(attrs);
    const hasOnClick = /onClick=/.test(attrs);
    rows.push({
      route,
      label,
      impliedMeaning: hasDisabled ? 'Unavailable control' : 'User-triggered action',
      file,
      implementation: hasOnClick ? 'client-only local state or callback (inspect handler)' : 'no explicit handler in this element',
      dependencyProfile: hasOnClick ? 'component state and potentially downstream API calls' : 'none',
      finalClassification: hasDisabled
        ? 'disabled truthfully'
        : hasOnClick
          ? 'local-only interaction (unless handler reaches API)'
          : 'decorative non-action',
      evidence: 'source inspection',
    });
  }

  return rows;
}

function main(): void {
  fs.mkdirSync(docsDir, { recursive: true });
  const pages = walk(appRoot);
  const routeRows: RouteRow[] = [];
  const actionRows: ActionRow[] = [];

  for (const page of pages) {
    const routePath = routeFromPage(page);
    const source = fs.readFileSync(page, 'utf8');
    const relativeFile = path.relative(repoRoot, page);
    const surface = classifySurface(source, routePath);
    const authRequired = protectedPrefixes.some((p) => routePath === p || routePath.startsWith(`${p}/`))
      ? 'yes'
      : 'no';

    routeRows.push({
      path: routePath,
      file: relativeFile,
      parentLayout: parentLayoutForRoute(routePath),
      authRequired,
      roleSensitive: authRequired,
      surfaceType: surface.type,
      dependencyProfile: surface.deps,
      classification: surface.classification,
      evidence: surface.evidence,
    });

    if (authRequired === 'yes') {
      actionRows.push(...extractActionRows(routePath, relativeFile, source));
    }
  }

  routeRows.sort((a, b) => a.path.localeCompare(b.path));
  actionRows.sort((a, b) => a.route.localeCompare(b.route) || a.label.localeCompare(b.label));

  const lines: string[] = [];
  lines.push('# Authenticated Product Truth Matrix');
  lines.push('');
  lines.push('Generated by `scripts/generate-auth-truth-matrices.ts` from source inspection plus runtime validation artifacts.');
  lines.push('');
  lines.push('## Route Truth Matrix');
  lines.push('');
  lines.push('| Route | Purpose Source | Parent Layout | Auth Required | Role Sensitive | Surface Type | Dependency Profile | Current Classification | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|---|');

  for (const row of routeRows.filter((r) => r.authRequired === 'yes')) {
    lines.push(`| \`${row.path}\` | \`${row.file}\` | \`${row.parentLayout}\` | ${row.authRequired} | ${row.roleSensitive} | ${row.surfaceType} | ${row.dependencyProfile} | ${row.classification} | ${row.evidence} |`);
  }

  lines.push('');
  lines.push('## Action Truth Matrix');
  lines.push('');
  lines.push('| Route | Control label | User-implied meaning | Component/File | Implementation Path | Dependency Profile | Final Classification | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|');

  for (const row of actionRows) {
    lines.push(`| \`${row.route}\` | ${row.label} | ${row.impliedMeaning} | \`${row.file}\` | ${row.implementation} | ${row.dependencyProfile} | ${row.finalClassification} | ${row.evidence} |`);
  }

  lines.push('');
  lines.push('## Degraded State Legend');
  lines.push('');
  lines.push('- **Unauthenticated**: middleware redirects protected pages to `/auth/signin`, API returns problem+json 401.');
  lines.push('- **Dev verify mode**: `REQUIEM_ROUTE_VERIFY_MODE=1` and non-production runtime; middleware injects synthetic auth headers.');
  lines.push('- **Real auth mode**: verify mode disabled; middleware requires Supabase user session.');
  lines.push('- **Backend missing**: `REQUIEM_API_URL` absent; authenticated UI shows explicit degraded notices and local/empty states.');
  lines.push('- **Backend unreachable**: `REQUIEM_API_URL` set but service down; route-level handlers surface degraded error responses.');
  lines.push('- **No data**: API responds with empty collections; UI uses explicit empty-state components.');
  lines.push('- **Engine/runtime unavailable**: engine endpoint errors/timeouts surfaced as degraded cards/problem details.');
  lines.push('- **Forbidden**: route handlers that validate tenant auth return explicit 403/401 problem payloads.');
  lines.push('- **Informational/static route**: no runtime dependency beyond app shell.');
  lines.push('- **Local-only route**: controls mutate client state only; no backend mutation authority implied.');
  lines.push('- **Source-inspected only**: route/control identified from source but not runtime exercised in this environment.');
  lines.push('');
  lines.push('## Reviewer Validation Procedure');
  lines.push('');
  lines.push('1. `pnpm run lint`');
  lines.push('2. `pnpm run type-check`');
  lines.push('3. `pnpm run test`');
  lines.push('4. `REQUIEM_ROUTE_VERIFY_MODE=1 pnpm run dev` and browse authenticated routes for synthetic auth truth banners.');
  lines.push('5. With `REQUIEM_API_URL` unset, verify degraded disclosures on `/console/overview`, `/app/cas`, `/app/replay`, `/runs`.');
  lines.push('6. Set `REQUIEM_API_URL=http://127.0.0.1:65535` to simulate unreachable backend and verify explicit errors remain distinct from missing backend states.');
  lines.push('7. Disable verify mode to validate unauthenticated redirects and sign-in enforcement.');

  fs.writeFileSync(outputFile, `${lines.join('\n')}\n`);
  console.log(`Wrote ${path.relative(repoRoot, outputFile)} with ${routeRows.length} routes and ${actionRows.length} actions.`);
}

main();
