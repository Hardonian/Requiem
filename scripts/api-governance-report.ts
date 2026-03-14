#!/usr/bin/env tsx
import { promises as fs } from 'node:fs';
import path from 'node:path';

type Method = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS'|'HEAD';
type RouteRow = {
  routeId: string; path: string; methods: Method[]; sourceFile: string;
  registeredInManifest: boolean; inOpenApi: boolean; auth: 'public'|'protected';
  tenancy: 'tenant-scoped'|'global'; inputValidation: 'schema-validated'|'manual-or-none';
  outputContract: 'typed-or-shaped'|'untyped'; testCoverage: 'covered'|'not-detected';
  sdkExposure: 'openapi'|'none'; notes: string;
};

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, 'ready-layer', 'src', 'app', 'api');
const testsRoot = path.join(repoRoot, 'ready-layer', 'tests');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

function routePathFromFile(file: string): string {
  const relative = path.relative(apiRoot, path.dirname(file)).split(path.sep).join('/');
  return (`/api${relative ? `/${relative}` : ''}`).replace(/\/+/g, '/');
}

async function main() {
  const routeFiles = (await walk(apiRoot)).filter((f) => f.endsWith('/route.ts'));
  const testContent = (await Promise.all((await walk(testsRoot)).filter((f) => f.endsWith('.test.ts')).map((f) => fs.readFile(f, 'utf8')))).join('\n');
  const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, 'routes.manifest.json'), 'utf8')) as { routes: Array<{ path: string; method?: string }> };
  const manifestSet = new Set(manifest.routes.map((r) => `${r.path}#${(r.method ?? 'GET').toUpperCase()}`));
  const openapiSource = await fs.readFile(path.join(apiRoot, 'openapi.json', 'route.ts'), 'utf8');
  const openapiPaths = new Set([...openapiSource.matchAll(/'\/api\/[^']+'\s*:/g)].map((m) => m[0].split(':')[0].replace(/'/g, '').trim()));

  const rows: RouteRow[] = [];
  const routeIds = new Map<string, string[]>();

  for (const file of routeFiles) {
    const source = await fs.readFile(file, 'utf8');
    const p = routePathFromFile(file);
    const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g)].map((m) => m[1] as Method);
    const routeId = source.match(/routeId:\s*'([^']+)'/)?.[1] ?? p.replace(/[^a-zA-Z0-9]+/g, '.');
    routeIds.set(routeId, [...(routeIds.get(routeId) ?? []), p]);
    rows.push({
      routeId,
      path: p,
      methods,
      sourceFile: path.relative(repoRoot, file).split(path.sep).join('/'),
      registeredInManifest: methods.every((m) => manifestSet.has(`${p}#${m}`)),
      inOpenApi: openapiPaths.has(p),
      auth: source.includes('requireAuth: false') ? 'public' : 'protected',
      tenancy: source.includes('ctx.tenant_id') || source.includes('tenant_id') ? 'tenant-scoped' : 'global',
      inputValidation: source.includes('parseJsonWithSchema') || source.includes('z.object(') ? 'schema-validated' : 'manual-or-none',
      outputContract: source.includes('NextResponse.json(') ? 'typed-or-shaped' : 'untyped',
      testCoverage: testContent.includes(p) ? 'covered' : 'not-detected',
      sdkExposure: openapiPaths.has(p) ? 'openapi' : 'none',
      notes: source.includes('withTenantContext(') ? 'withTenantContext wrapper' : 'no withTenantContext wrapper',
    });
  }

  rows.sort((a,b)=>a.path.localeCompare(b.path));
  const implSet = new Set(rows.flatMap((r) => r.methods.map((m) => `${r.path}#${m}`)));
  const findings = {
    unregistered: rows.flatMap((r) => r.methods.filter((m) => !manifestSet.has(`${r.path}#${m}`)).map((m) => `${r.path} ${m}`)),
    duplicates: [...routeIds.entries()].filter(([, arr]) => arr.length > 1).map(([id, arr]) => `${id}: ${arr.join(', ')}`),
    deadManifest: [...manifestSet].filter((entry) => !implSet.has(entry)),
  };

  const matrix = rows.map((r) => ({
    surface: `${r.path} [${r.methods.join(',')}]`,
    currentCoverage: r.testCoverage === 'covered' ? 'route tests detected' : 'none detected',
    missingCoverage: r.testCoverage === 'covered' ? 'deeper regression optional' : 'auth/validation contract tests',
    recommendedTestType: r.auth === 'public' ? 'smoke + contract' : 'integration + contract',
    priority: r.auth === 'public' || r.tenancy === 'tenant-scoped' ? 'high' : 'medium',
  }));

  await fs.mkdir(path.join(repoRoot, 'reports', 'api-governance'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'reports', 'api-governance', 'API_SURFACE_MAP.json'), JSON.stringify({ generatedAt: new Date().toISOString(), routes: rows, findings, testCoverageMatrix: matrix }, null, 2));

  const table = rows.map((r) => `| ${r.path} | ${r.methods.join(', ')} | ${r.sourceFile} | ${r.registeredInManifest ? 'yes' : 'no'} | ${r.inOpenApi ? 'yes' : 'no'} | ${r.auth} | ${r.tenancy} | ${r.inputValidation} | ${r.testCoverage} | ${r.sdkExposure} |`).join('\n');
  const matrixRows = matrix.map((m) => `| ${m.surface} | ${m.currentCoverage} | ${m.missingCoverage} | ${m.recommendedTestType} | ${m.priority} |`).join('\n');

  await fs.writeFile(path.join(repoRoot, 'docs', 'API_SURFACE.md'),
`# API Surface\n\n## API_SURFACE_MAP\n\n| Path | Methods | Source | Registered | OpenAPI | Auth | Tenancy | Validation | Tests | SDK |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${table}\n\n## UNREGISTERED_OR_UNMAPPED_ROUTE_LIST\n${findings.unregistered.length ? findings.unregistered.map((x) => `- ${x}`).join('\n') : '- none'}\n\n## DEAD_OR_DUPLICATE_ROUTE_LIST\n### Duplicate route ids\n${findings.duplicates.length ? findings.duplicates.map((x) => `- ${x}`).join('\n') : '- none'}\n### Manifest entries without handler\n${findings.deadManifest.length ? findings.deadManifest.map((x) => `- ${x}`).join('\n') : '- none'}\n`);

  await fs.writeFile(path.join(repoRoot, 'docs', 'API_GOVERNANCE.md'),
`# API Governance\n\nRoute class policy:\n- public: requireAuth false on withTenantContext wrapper\n- protected: default auth required\n- tenant-scoped: tenant id consumed in handler context\n- global: no tenant input consumed\n\n## TEST_COVERAGE_MATRIX\n\n| Surface | Current | Missing | Recommended | Priority |\n| --- | --- | --- | --- | --- |\n${matrixRows}\n\n## SDK_SURFACE_MAP\n- sdk/typescript, sdk/python, sdk/go are README placeholders only; no generated client code exists.\n\n## Load/performance decision\n- Existing verify-routes-runtime script already performs bounded burst calls against /api/runs and checks 429 contracts.\n- No additional load harness added in this pass.\n`);

  await fs.writeFile(path.join(repoRoot, 'docs', 'TESTING_STRATEGY.md'),
`# Testing Strategy\n\n- Unit: isolated package tests in packages/*/tests.\n- Integration: route/auth/validation tests in ready-layer/tests.\n- Smoke: scripts/verify-routes-runtime.ts.\n- Light load: burst check in scripts/verify-routes-runtime.ts for /api/runs.\n\nAdded in this pass:\n- ready-layer/tests/openapi-route-parity.test.ts\n`);

  await fs.writeFile(path.join(repoRoot, 'docs', 'SDK_OVERVIEW.md'),
`# SDK Overview\n\nCurrent state: SDK directories contain README placeholders only (no generated clients).\nSource of truth: ready-layer/src/app/api handlers plus /api/openapi.json route contract object.\n`);

  await fs.writeFile(path.join(repoRoot, 'docs', 'DEVELOPER_TOOLKIT.md'),
`# Developer Toolkit\n\n- scripts/api-governance-report.ts: API inventory + governance docs generation.\n- scripts/verify-routes.ts: route manifest + hard-500 checks.\n- scripts/verify-routes-runtime.ts: runtime smoke checks and problem-json assertions.\n`);

  console.log(`API governance report generated for ${rows.length} API routes.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
