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
  surfaceType: string;
  dependencyProfile: string;
  classification: string;
  evidence: string;
};

type HandlerInsight = {
  implementation: string;
  dependencyProfile: string;
  finalClassification: string;
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
  const hasApiCalls = /(fetch\(|axios\.|\/api\/|useQuery|queryFn|mutation|useSWR)/.test(source);
  const hasBackendDependency = /(REQUIEM_API_URL|engine|runtime|supabase|tenant)/i.test(source);
  const hasControls = /(<button|<Link|onClick=|onChange=|onSubmit=)/.test(source);
  const authRequired = protectedPrefixes.some((p) => routePath === p || routePath.startsWith(`${p}/`));

  if (!authRequired) {
    return {
      type: 'static/informational',
      deps: 'none beyond app runtime',
      classification: 'healthy',
      evidence: 'source inspection',
    };
  }

  if (hasApiCalls && hasBackendDependency) {
    return {
      type: 'runtime-backed',
      deps: 'auth session + REQUIEM_API_URL + backend reachability (route-specific data)',
      classification: 'runtime-backed (source-inspected; runtime varies by backend/data/auth state)',
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

  if (hasControls) {
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
    if (t.isJSXText(child)) {
      parts.push(child.value);
      continue;
    }

    if (t.isJSXElement(child)) {
      parts.push(extractText(child.children));
      continue;
    }

    if (t.isJSXExpressionContainer(child)) {
      if (t.isStringLiteral(child.expression)) {
        parts.push(child.expression.value);
      } else if (t.isTemplateLiteral(child.expression) && child.expression.expressions.length === 0) {
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

function getOnClickHandlerName(attribute: t.JSXAttribute | null): string | null {
  if (!attribute || !attribute.value || !t.isJSXExpressionContainer(attribute.value)) return null;
  const expr = attribute.value.expression;
  if (t.isIdentifier(expr)) return expr.name;
  if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) return '[inline handler]';
  return '[dynamic handler]';
}

function collectHandlers(ast: t.File, source: string): Map<string, HandlerInsight> {
  const map = new Map<string, HandlerInsight>();

  const getInsight = (snippet: string): HandlerInsight => {
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
        finalClassification: 'runtime-backed but not always provable in this environment',
      };
    }
    if (/set[A-Z]|useState|dispatch\(/.test(snippet)) {
      return {
        implementation: 'client-only local state callback',
        dependencyProfile: 'component state only',
        finalClassification: 'local-only interaction',
      };
    }

    return {
      implementation: 'callback handler (requires source review)',
      dependencyProfile: 'depends on handler internals',
      finalClassification: 'source-inspected only',
    };
  };

  traverse(ast, (node) => {
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id) && (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init))) {
      const start = node.init.start ?? 0;
      const end = node.init.end ?? start;
      map.set(node.id.name, getInsight(source.slice(start, end)));
    }

    if (t.isFunctionDeclaration(node) && node.id) {
      const start = node.start ?? 0;
      const end = node.end ?? start;
      map.set(node.id.name, getInsight(source.slice(start, end)));
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
    const isButtonLike = name === 'button' || name.endsWith('.Trigger') || name === 'Button';
    const isLink = name === 'Link' || name === 'a';
    if (!isButtonLike && !isLink) return;

    const textLabel = extractText(node.children);
    const ariaLabel = getAttributeLiteralValue(getJsxAttribute(node.openingElement, 'aria-label'));
    const label = (textLabel || ariaLabel || `[${name} with dynamic label]`).replace(/\|/g, '\\|');
    const disabledAttr = getJsxAttribute(node.openingElement, 'disabled') ?? getJsxAttribute(node.openingElement, 'aria-disabled');
    const disabled = disabledAttr !== null;

    if (isLink) {
      const href = getAttributeLiteralValue(getJsxAttribute(node.openingElement, 'href')) ?? '[dynamic route]';
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

    const onClick = getJsxAttribute(node.openingElement, 'onClick');
    const handlerName = getOnClickHandlerName(onClick);
    const insight = handlerName ? handlers.get(handlerName) : null;

    rows.push({
      route,
      label,
      impliedMeaning: disabled ? 'Unavailable control' : 'User-triggered action',
      file,
      implementation: disabled
        ? 'disabled control'
        : insight?.implementation ?? (handlerName ? `handler: ${handlerName}` : 'no explicit onClick handler'),
      dependencyProfile: disabled
        ? 'none while disabled'
        : insight?.dependencyProfile ?? (handlerName ? 'depends on handler implementation' : 'none'),
      finalClassification: disabled
        ? 'disabled truthfully'
        : insight?.finalClassification ?? (handlerName ? 'source-inspected only' : 'decorative non-action'),
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

function markdownCell(value: string): string {
  return value.replace(/\n/g, ' ').replace(/\|/g, '\\|');
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
    const authRequired = protectedPrefixes.some((p) => routePath === p || routePath.startsWith(`${p}/`)) ? 'yes' : 'no';

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
    lines.push(`| \`${markdownCell(row.path)}\` | \`${markdownCell(row.file)}\` | \`${markdownCell(row.parentLayout)}\` | ${row.authRequired} | ${row.roleSensitive} | ${markdownCell(row.surfaceType)} | ${markdownCell(row.dependencyProfile)} | ${markdownCell(row.classification)} | ${markdownCell(row.evidence)} |`);
  }

  lines.push('');
  lines.push('## Action Truth Matrix');
  lines.push('');
  lines.push('| Route | Control label | User-implied meaning | Component/File | Implementation Path | Dependency Profile | Final Classification | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|');

  for (const row of actionRows) {
    lines.push(`| \`${markdownCell(row.route)}\` | ${markdownCell(row.label)} | ${markdownCell(row.impliedMeaning)} | \`${markdownCell(row.file)}\` | ${markdownCell(row.implementation)} | ${markdownCell(row.dependencyProfile)} | ${markdownCell(row.finalClassification)} | ${markdownCell(row.evidence)} |`);
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
