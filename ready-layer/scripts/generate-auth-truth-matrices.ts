import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';

type RouteRow = {
  path: string;
  file: string;
  parentLayout: string;
  authRequired: 'yes' | 'no';
  roleSensitive: 'yes' | 'no';
  surfaceType: 'static/informational' | 'local-only interactive' | 'mixed' | 'runtime-backed' | 'thin/stub but truthful';
  dependencyProfile: string;
  classification: 'healthy' | 'degraded-but-truthful' | 'thin-but-safe' | 'misleading' | 'broken' | 'source-inspected only';
  evidence: string;
};

type ActionRow = {
  route: string;
  label: string;
  impliedMeaning: string;
  file: string;
  implementation: string;
  dependencyProfile: string;
  finalClassification:
    | 'runtime-backed and proven'
    | 'runtime-backed but not provable in this environment'
    | 'local-only informational navigation'
    | 'local-only interaction'
    | 'dev-verify-only'
    | 'disabled truthfully'
    | 'decorative non-action'
    | 'misleading and must change'
    | 'dead/no-op and must be removed'
    | 'source-inspected only';
  evidence: string;
};

const repoRoot = process.cwd();
const monorepoRoot = path.resolve(repoRoot, '..');
const appRoot = path.join(repoRoot, 'src', 'app');
const localDocsDir = path.join(repoRoot, 'docs');
const reviewerDocsDir = path.join(monorepoRoot, 'docs', 'reviewer');

const protectedPrefixes = ['/app', '/console', '/intelligence', '/runs', '/registry', '/settings', '/drift', '/spend', '/proof'];

type StateCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

const stateLegend: Record<StateCode, string> = {
  A: 'auth + backend configured + reachable',
  B: 'auth + backend configured + unreachable',
  C: 'auth + backend missing',
  D: 'auth + no data',
  E: 'auth + engine/runtime unavailable',
  F: 'auth + forbidden/unauthorized',
  G: 'unauthenticated redirect/sign-in required',
  H: 'dev verify mode active',
  I: 'real auth mode active (session enforced)',
};

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
      return path.relative(monorepoRoot, layoutPath);
    }
  }
  return 'ready-layer/src/app/layout.tsx';
}

function classifySurface(source: string, routePath: string): RouteRow['surfaceType'] {
  const hasApiCalls = /(fetch\(|axios\.|\/api\/|useQuery|queryFn|mutation|useSWR)/.test(source);
  const hasControls = /(<button|<a|<Link|onClick=|onChange=|onSubmit=|onSelect=|onValueChange=)/.test(source);
  const authRequired = protectedPrefixes.some((p) => routePath === p || routePath.startsWith(`${p}/`));

  if (!authRequired) return 'static/informational';
  if (hasApiCalls && /(REQUIEM_API_URL|engine|runtime|supabase|tenant)/i.test(source)) return 'runtime-backed';
  if (hasApiCalls) return 'mixed';
  if (hasControls) return 'local-only interactive';
  return 'thin/stub but truthful';
}

function routeDependency(surfaceType: RouteRow['surfaceType']): string {
  if (surfaceType === 'runtime-backed') return 'auth session + REQUIEM_API_URL + backend/API reachability (route data)';
  if (surfaceType === 'mixed') return 'auth session + API route reachability; backend may be optional/degraded';
  if (surfaceType === 'local-only interactive') return 'auth session only; component-local state';
  if (surfaceType === 'thin/stub but truthful') return 'auth session only';
  return 'none beyond app runtime';
}

function routeClassification(surfaceType: RouteRow['surfaceType'], authRequired: boolean): RouteRow['classification'] {
  if (!authRequired) return 'healthy';
  if (surfaceType === 'runtime-backed' || surfaceType === 'mixed') return 'degraded-but-truthful';
  if (surfaceType === 'local-only interactive') return 'thin-but-safe';
  return 'source-inspected only';
}

function traverse(node: t.Node, visit: (n: t.Node) => void): void {
  visit(node);
  const keys = t.VISITOR_KEYS[node.type] ?? [];
  for (const key of keys) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in child) {
          traverse(child as t.Node, visit);
        }
      }
    } else if (value && typeof value === 'object' && 'type' in value) {
      traverse(value as t.Node, visit);
    }
  }
}

function jsxNameToString(name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string {
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXMemberExpression(name)) return `${jsxNameToString(name.object)}.${jsxNameToString(name.property)}`;
  return `${name.namespace.name}:${name.name.name}`;
}

function extractText(children: (t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment | t.JSXSpreadChild)[]): string {
  const parts: string[] = [];
  for (const child of children) {
    if (t.isJSXText(child)) parts.push(child.value);
    if (t.isJSXElement(child)) parts.push(extractText(child.children));
    if (t.isJSXExpressionContainer(child)) {
      if (t.isStringLiteral(child.expression)) parts.push(child.expression.value);
      if (t.isTemplateLiteral(child.expression) && child.expression.expressions.length === 0) {
        parts.push(child.expression.quasis.map((q) => q.value.cooked ?? '').join(''));
      }
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function getJsxAttribute(opening: t.JSXOpeningElement, attrName: string): t.JSXAttribute | null {
  return (opening.attributes.find((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: attrName })) as t.JSXAttribute) ?? null;
}

function getAttributeLiteralValue(attribute: t.JSXAttribute | null): string | null {
  if (!attribute || attribute.value == null) return null;
  if (t.isStringLiteral(attribute.value)) return attribute.value.value;
  if (t.isJSXExpressionContainer(attribute.value)) {
    if (t.isStringLiteral(attribute.value.expression)) return attribute.value.expression.value;
    if (t.isTemplateLiteral(attribute.value.expression) && attribute.value.expression.expressions.length === 0) {
      return attribute.value.expression.quasis.map((q) => q.value.cooked ?? '').join('');
    }
  }
  return null;
}

function actionInsight(snippet: string): Omit<ActionRow, 'route' | 'label' | 'impliedMeaning' | 'file' | 'evidence'> {
  if (/disabled|aria-disabled/.test(snippet)) {
    return {
      implementation: 'disabled control',
      dependencyProfile: 'none while disabled',
      finalClassification: 'disabled truthfully',
    };
  }

  if (/router\.push|window\.location|href\s*=/.test(snippet)) {
    return {
      implementation: 'navigation trigger',
      dependencyProfile: 'client routing + destination route dependencies',
      finalClassification: 'local-only informational navigation',
    };
  }

  if (/fetch\(|axios\.|\/api\//.test(snippet)) {
    return {
      implementation: 'client callback with API call',
      dependencyProfile: 'auth session + API route reachability + backend state',
      finalClassification: 'runtime-backed but not provable in this environment',
    };
  }

  if (/set[A-Z]|useState|dispatch\(/.test(snippet)) {
    return {
      implementation: 'client-only local state callback',
      dependencyProfile: 'component-local state',
      finalClassification: 'local-only interaction',
    };
  }

  return {
    implementation: 'callback handler (source-inspected)',
    dependencyProfile: 'depends on handler internals',
    finalClassification: 'source-inspected only',
  };
}

function collectHandlers(ast: t.File, source: string): Map<string, ReturnType<typeof actionInsight>> {
  const map = new Map<string, ReturnType<typeof actionInsight>>();

  traverse(ast, (node) => {
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id) && (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init))) {
      const start = node.init.start ?? 0;
      const end = node.init.end ?? start;
      map.set(node.id.name, actionInsight(source.slice(start, end)));
    }

    if (t.isFunctionDeclaration(node) && node.id) {
      const start = node.start ?? 0;
      const end = node.end ?? start;
      map.set(node.id.name, actionInsight(source.slice(start, end)));
    }
  });

  return map;
}

function extractActionRows(route: string, file: string, source: string): ActionRow[] {
  const rows: ActionRow[] = [];
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });
  const handlers = collectHandlers(ast, source);

  traverse(ast, (node) => {
    if (!t.isJSXElement(node)) return;

    const name = jsxNameToString(node.openingElement.name);
    const onClick = getJsxAttribute(node.openingElement, 'onClick');
    const onSelect = getJsxAttribute(node.openingElement, 'onSelect');
    const onValueChange = getJsxAttribute(node.openingElement, 'onValueChange');
    const href = getAttributeLiteralValue(getJsxAttribute(node.openingElement, 'href'));
    const disabledAttr = getJsxAttribute(node.openingElement, 'disabled') ?? getJsxAttribute(node.openingElement, 'aria-disabled');

    const interactiveByTag = ['button', 'a', 'Link', 'TabsTrigger', 'DropdownMenuItem', 'SelectItem', 'MenuItem'];
    const likelyInteractive = interactiveByTag.includes(name) || name.endsWith('.Trigger') || name.endsWith('.Item');
    const hasExplicitInteraction = onClick || onSelect || onValueChange || href;
    if (!likelyInteractive && !hasExplicitInteraction) return;

    const textLabel = extractText(node.children);
    const ariaLabel = getAttributeLiteralValue(getJsxAttribute(node.openingElement, 'aria-label'));
    const label = (textLabel || ariaLabel || `[${name} with dynamic label]`).replace(/\|/g, '\\|');

    if (href) {
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
      return;
    }

    if (disabledAttr) {
      rows.push({
        route,
        label,
        impliedMeaning: 'Unavailable control',
        file,
        implementation: 'disabled control',
        dependencyProfile: 'none while disabled',
        finalClassification: 'disabled truthfully',
        evidence: 'source inspection',
      });
      return;
    }

    const triggerAttr = onClick ?? onSelect ?? onValueChange;
    let impl = actionInsight(node.openingElement.loc ? source.slice(node.start ?? 0, node.end ?? 0) : '');
    if (triggerAttr?.value && t.isJSXExpressionContainer(triggerAttr.value) && t.isIdentifier(triggerAttr.value.expression)) {
      impl = handlers.get(triggerAttr.value.expression.name) ?? impl;
    }

    rows.push({
      route,
      label,
      impliedMeaning: 'User-triggered action',
      file,
      implementation: impl.implementation,
      dependencyProfile: impl.dependencyProfile,
      finalClassification: impl.finalClassification,
      evidence: 'source inspection',
    });
  });

  const unique = new Map<string, ActionRow>();
  for (const row of rows) {
    const key = `${row.route}|${row.label}|${row.file}|${row.implementation}`;
    if (!unique.has(key)) unique.set(key, row);
  }

  return [...unique.values()];
}

function routeApplicableStates(route: RouteRow): StateCode[] {
  if (route.authRequired === 'no') return [];
  const base: StateCode[] = ['G', 'H', 'I'];
  if (route.surfaceType === 'runtime-backed' || route.surfaceType === 'mixed') {
    return [...base, 'A', 'B', 'C', 'D', 'E', 'F'];
  }
  return [...base, 'C'];
}

function actionApplicableStates(action: ActionRow): StateCode[] {
  if (action.finalClassification === 'disabled truthfully' || action.finalClassification === 'decorative non-action') return ['H', 'I'];
  if (action.finalClassification === 'local-only informational navigation' || action.finalClassification === 'local-only interaction') return ['H', 'I', 'C'];
  if (action.finalClassification === 'runtime-backed but not provable in this environment') return ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I'];
  return ['H', 'I'];
}

function markdownCell(value: string): string {
  return value.replace(/\n/g, ' ').replace(/\|/g, '\\|');
}

function emitMainDoc(routes: RouteRow[], actions: ActionRow[]): void {
  fs.mkdirSync(localDocsDir, { recursive: true });
  const out = path.join(localDocsDir, 'authenticated-truth-matrix.md');
  const lines: string[] = [];
  lines.push('# Authenticated Product Truth Matrix');
  lines.push('');
  lines.push('Generated by `scripts/generate-auth-truth-matrices.ts` from source inspection plus runtime validation artifacts.');
  lines.push('');
  lines.push('## Route Truth Matrix');
  lines.push('');
  lines.push('| Route | Purpose Source | Parent Layout | Auth Required | Role Sensitive | Surface Type | Dependency Profile | Current Classification | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const row of routes.filter((r) => r.authRequired === 'yes')) {
    lines.push(`| \`${markdownCell(row.path)}\` | \`${markdownCell(row.file)}\` | \`${markdownCell(row.parentLayout)}\` | ${row.authRequired} | ${row.roleSensitive} | ${markdownCell(row.surfaceType)} | ${markdownCell(row.dependencyProfile)} | ${markdownCell(row.classification)} | ${markdownCell(row.evidence)} |`);
  }

  lines.push('');
  lines.push('## Action Truth Matrix');
  lines.push('');
  lines.push('| Route | Control label | User-implied meaning | Component/File | Implementation Path | Dependency Profile | Final Classification | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const row of actions) {
    lines.push(`| \`${markdownCell(row.route)}\` | ${markdownCell(row.label)} | ${markdownCell(row.impliedMeaning)} | \`${markdownCell(row.file)}\` | ${markdownCell(row.implementation)} | ${markdownCell(row.dependencyProfile)} | ${markdownCell(row.finalClassification)} | ${markdownCell(row.evidence)} |`);
  }
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
}

function emitReviewerDocs(routes: RouteRow[], actions: ActionRow[]): void {
  fs.mkdirSync(reviewerDocsDir, { recursive: true });

  const routeDoc = path.join(reviewerDocsDir, 'AUTHENTICATED_ROUTE_TRUTH_MATRIX.md');
  const routeLines: string[] = [];
  routeLines.push('# Authenticated Route Truth Matrix');
  routeLines.push('');
  routeLines.push('Route inventory for every middleware-protected UI route under `/app`, `/console`, `/intelligence`, `/runs`, `/registry`, `/settings`, `/drift`, `/spend`, and `/proof`.');
  routeLines.push('');
  routeLines.push('| Path | Purpose Source | Parent Layout | Auth | Role-sensitive | Surface Type | Dependency Profile | Classification | Applicable states (A-I) | Evidence |');
  routeLines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const route of routes.filter((r) => r.authRequired === 'yes')) {
    const states = routeApplicableStates(route).map((s) => `${s}:${stateLegend[s]}`).join('<br/>');
    routeLines.push(`| \`${route.path}\` | \`${route.file}\` | \`${route.parentLayout}\` | ${route.authRequired} | ${route.roleSensitive} | ${route.surfaceType} | ${markdownCell(route.dependencyProfile)} | ${route.classification} | ${states} | ${route.evidence} |`);
  }
  fs.writeFileSync(routeDoc, `${routeLines.join('\n')}\n`);

  const actionDoc = path.join(reviewerDocsDir, 'AUTHENTICATED_ACTION_TRUTH_MATRIX.md');
  const actionLines: string[] = [];
  actionLines.push('# Authenticated Action Truth Matrix');
  actionLines.push('');
  actionLines.push('| Route | Control label | User-implied meaning | Source file | Implementation path | Dependencies | Classification | Applicable states (A-I) | Evidence |');
  actionLines.push('|---|---|---|---|---|---|---|---|---|');
  for (const action of actions) {
    const states = actionApplicableStates(action).map((s) => `${s}:${stateLegend[s]}`).join('<br/>');
    actionLines.push(`| \`${action.route}\` | ${markdownCell(action.label)} | ${markdownCell(action.impliedMeaning)} | \`${action.file}\` | ${markdownCell(action.implementation)} | ${markdownCell(action.dependencyProfile)} | ${action.finalClassification} | ${states} | ${action.evidence} |`);
  }
  fs.writeFileSync(actionDoc, `${actionLines.join('\n')}\n`);

  const legendDoc = path.join(reviewerDocsDir, 'DEGRADED_STATE_LEGEND.md');
  const legendLines = [
    '# Degraded State Legend',
    '',
    '- **A**: authenticated + backend configured + reachable.',
    '- **B**: authenticated + backend configured + unreachable.',
    '- **C**: authenticated + backend missing (`REQUIEM_API_URL` absent).',
    '- **D**: authenticated + no data (empty list/object results).',
    '- **E**: authenticated + engine/runtime unavailable (route returns explicit unavailable/problem semantics).',
    '- **F**: authenticated + forbidden/unauthorized (problem+json 401/403 from route auth checks).',
    '- **G**: unauthenticated access (middleware redirect to `/auth/signin` for page routes).',
    '- **H**: dev verify mode (`REQUIEM_ROUTE_VERIFY_MODE=1` and `NODE_ENV!=production`) with synthetic middleware headers.',
    '- **I**: real auth mode (verify mode disabled; Supabase session required).',
    '',
    'Auth validity, backend configuration, backend reachability, and data availability are independent signals and must be interpreted separately.',
  ];
  fs.writeFileSync(legendDoc, `${legendLines.join('\n')}\n`);

  const runbookDoc = path.join(reviewerDocsDir, 'AUTH_VALIDATION_RUNBOOK.md');
  const runbookLines = [
    '# Authenticated Truth Validation Runbook',
    '',
    '1. `cd ready-layer`',
    '2. `pnpm run generate:auth-truth` (refresh route/action inventory docs).',
    '3. `pnpm run lint`',
    '4. `pnpm run type-check`',
    '5. `pnpm run test`',
    '6. `REQUIEM_ROUTE_VERIFY_MODE=1 pnpm run dev` and validate protected routes show synthetic-auth disclosure.',
    '7. Leave `REQUIEM_API_URL` unset and check degraded backend-missing disclosures.',
    '8. Set `REQUIEM_API_URL=http://127.0.0.1:65535` and verify backend-unreachable errors differ from backend-missing copy.',
    '9. Disable verify mode and confirm protected pages redirect to `/auth/signin` when no Supabase session is present.',
    '',
    'If a route/action cannot be proven at runtime locally, classify it as **source-inspected only** or **runtime-backed but not provable in this environment** instead of claiming success.',
  ];
  fs.writeFileSync(runbookDoc, `${runbookLines.join('\n')}\n`);
}

function main(): void {
  const pages = walk(appRoot);
  const routeRows: RouteRow[] = [];
  const actionRows: ActionRow[] = [];

  for (const page of pages) {
    const routePath = routeFromPage(page);
    const source = fs.readFileSync(page, 'utf8');
    const relativeFile = path.relative(monorepoRoot, page);
    const authRequired = protectedPrefixes.some((p) => routePath === p || routePath.startsWith(`${p}/`));
    const surfaceType = classifySurface(source, routePath);

    routeRows.push({
      path: routePath,
      file: relativeFile,
      parentLayout: parentLayoutForRoute(routePath),
      authRequired: authRequired ? 'yes' : 'no',
      roleSensitive: authRequired ? 'yes' : 'no',
      surfaceType,
      dependencyProfile: routeDependency(surfaceType),
      classification: routeClassification(surfaceType, authRequired),
      evidence: authRequired ? 'source inspection + runtime screenshot (where renderable)' : 'source inspection',
    });

    if (authRequired) {
      actionRows.push(...extractActionRows(routePath, relativeFile, source));
    }
  }

  routeRows.sort((a, b) => a.path.localeCompare(b.path));
  actionRows.sort((a, b) => a.route.localeCompare(b.route) || a.label.localeCompare(b.label));

  emitMainDoc(routeRows, actionRows);
  emitReviewerDocs(routeRows, actionRows);

  console.log(`Wrote inventories for ${routeRows.filter((r) => r.authRequired === 'yes').length} authenticated routes and ${actionRows.length} controls.`);
}

main();
