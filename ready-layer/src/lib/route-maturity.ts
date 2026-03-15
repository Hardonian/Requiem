export type RouteMaturityClass =
  | 'runtime-backed'
  | 'runtime-degraded'
  | 'informational'
  | 'demo'
  | 'local-only'
  | 'unavailable';

export type RuntimeDependencyClass = 'none' | 'auth' | 'backend' | 'auth+backend' | 'local-runtime';
export type RouteUiMode = 'operational' | 'restricted' | 'informational';
export type NavStatus = 'primary' | 'degraded' | 'demo' | 'info';

export interface RouteMaturityRecord {
  path: string;
  navGroup: 'platform' | 'operations' | 'support';
  navLabel: string;
  maturity: RouteMaturityClass;
  runtimeDependency: RuntimeDependencyClass;
  authRequired: boolean;
  backendRequired: boolean;
  disclosureRequired: boolean;
  navStatus: NavStatus;
  ctaRestriction: 'none' | 'no-destructive' | 'read-only';
  degradedBehavior: string;
  uiMode: RouteUiMode;
  summary: string;
}

export const routeMaturityCatalog: readonly RouteMaturityRecord[] = [
  {
    path: '/console/overview',
    navGroup: 'platform',
    navLabel: 'Overview',
    maturity: 'runtime-degraded',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: true,
    navStatus: 'degraded',
    ctaRestriction: 'read-only',
    degradedBehavior: 'Shows explicit standby metrics and backend wiring guidance when REQUIEM_API_URL is absent.',
    uiMode: 'operational',
    summary: 'Control plane landing page with truthful standby behavior.',
  },
  {
    path: '/console/architecture',
    navGroup: 'platform',
    navLabel: 'Architecture',
    maturity: 'runtime-degraded',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: true,
    navStatus: 'degraded',
    ctaRestriction: 'read-only',
    degradedBehavior: 'Displays dependency checks and unavailability states instead of fabricated health.',
    uiMode: 'operational',
    summary: 'Runtime architecture and dependency diagnostics.',
  },
  {
    path: '/console/guarantees',
    navGroup: 'platform',
    navLabel: 'Guarantees',
    maturity: 'runtime-degraded',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: true,
    navStatus: 'degraded',
    ctaRestriction: 'read-only',
    degradedBehavior: 'Shows static guarantee definitions plus local status when live checks are unavailable.',
    uiMode: 'operational',
    summary: 'Verification guarantees with bounded live status.',
  },
  {
    path: '/console/replication',
    navGroup: 'platform',
    navLabel: 'Replication',
    maturity: 'informational',
    runtimeDependency: 'none',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: true,
    navStatus: 'info',
    ctaRestriction: 'read-only',
    degradedBehavior: 'Always renders informational-only topology and synthetic telemetry.',
    uiMode: 'informational',
    summary: 'Reference-only replication concepts and topology.',
  },
  {
    path: '/console/logs',
    navGroup: 'operations',
    navLabel: 'Logs',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Returns empty/degraded state when backend is unreachable.',
    uiMode: 'operational',
    summary: 'Primary runtime operational evidence for logs.',
  },
  {
    path: '/console/runs',
    navGroup: 'operations',
    navLabel: 'Runs',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Shows fetch failure or empty-state messaging when runtime data is unavailable.',
    uiMode: 'operational',
    summary: 'Primary deterministic execution evidence surface.',
  },
  {
    path: '/console/plans',
    navGroup: 'operations',
    navLabel: 'Plans',
    maturity: 'demo',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: true,
    navStatus: 'demo',
    ctaRestriction: 'no-destructive',
    degradedBehavior: 'Uses demo-safe API responses; not proof of live orchestration.',
    uiMode: 'restricted',
    summary: 'Demo-backed plan workflow verification route.',
  },
  {
    path: '/console/policies',
    navGroup: 'operations',
    navLabel: 'Policies',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Displays runtime-backed policy telemetry, degraded when backend is unreachable.',
    uiMode: 'operational',
    summary: 'Policy runtime and control operations.',
  },
  {
    path: '/console/capabilities',
    navGroup: 'operations',
    navLabel: 'Capabilities',
    maturity: 'runtime-backed',
    runtimeDependency: 'auth+backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Auth or backend gaps surface as restricted/degraded capability state.',
    uiMode: 'operational',
    summary: 'Capability and token management surface.',
  },
  {
    path: '/console/finops',
    navGroup: 'operations',
    navLabel: 'FinOps',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Shows guarded budget views when backend feeds are absent.',
    uiMode: 'operational',
    summary: 'Cost and budget operational surface.',
  },
  {
    path: '/console/snapshots',
    navGroup: 'operations',
    navLabel: 'Snapshots',
    maturity: 'demo',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: true,
    navStatus: 'demo',
    ctaRestriction: 'no-destructive',
    degradedBehavior: 'Snapshot listing/restore is demo-safe and must not imply production rollback.',
    uiMode: 'restricted',
    summary: 'Demo-backed snapshot workflow checks.',
  },
  {
    path: '/registry',
    navGroup: 'operations',
    navLabel: 'Registry',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Empty state is explicit when object metadata indexing is unavailable.',
    uiMode: 'operational',
    summary: 'Registry object and package evidence surface.',
  },
  {
    path: '/spend',
    navGroup: 'operations',
    navLabel: 'Spend',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Uses explicit no-data and backend-degraded status states.',
    uiMode: 'operational',
    summary: 'Spend and policy cost management.',
  },
  {
    path: '/drift',
    navGroup: 'operations',
    navLabel: 'Drift',
    maturity: 'runtime-backed',
    runtimeDependency: 'backend',
    authRequired: true,
    backendRequired: true,
    disclosureRequired: false,
    navStatus: 'primary',
    ctaRestriction: 'none',
    degradedBehavior: 'Shows deterministic drift health and explicit unavailability messaging.',
    uiMode: 'operational',
    summary: 'Drift intelligence and variance analysis.',
  },
  {
    path: '/settings',
    navGroup: 'operations',
    navLabel: 'Settings',
    maturity: 'runtime-degraded',
    runtimeDependency: 'auth',
    authRequired: true,
    backendRequired: false,
    disclosureRequired: false,
    navStatus: 'degraded',
    ctaRestriction: 'read-only',
    degradedBehavior: 'Restricts settings actions when auth runtime is unavailable.',
    uiMode: 'restricted',
    summary: 'Settings route with auth-bound operational controls.',
  },
] as const;

export const routeMaturityByPath = Object.fromEntries(
  routeMaturityCatalog.map((route) => [route.path, route]),
) as Record<string, RouteMaturityRecord>;

export function getRouteMaturity(path: string): RouteMaturityRecord {
  const route = routeMaturityByPath[path];
  if (!route) {
    throw new Error(`No maturity definition found for route: ${path}`);
  }
  return route;
}

export function maturityNoteTone(maturity: RouteMaturityClass): 'runtime' | 'runtime-degraded' | 'demo' | 'informational' {
  if (maturity === 'runtime-backed') return 'runtime';
  if (maturity === 'runtime-degraded') return 'runtime-degraded';
  if (maturity === 'demo') return 'demo';
  return 'informational';
}
