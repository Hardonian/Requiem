export type RouteMaturityClass = 'runtime' | 'runtime-degraded' | 'demo' | 'informational' | 'local-only';

export type RuntimeDependency = 'none' | 'api-status' | 'api-runtime' | 'api-demo' | 'env-auth-backend';

export type DisclosureRequirement = 'none' | 'required-banner';

export type NavLabelPolicy = 'plain' | 'append-demo' | 'append-info';

export type CtaRestriction =
  | 'none'
  | 'no-live-verbs'
  | 'no-production-claims'
  | 'no-runtime-guarantee-claims';

export interface RouteMaturityRule {
  route: string;
  maturity: RouteMaturityClass;
  runtimeDependency: RuntimeDependency;
  disclosureRequirement: DisclosureRequirement;
  navEligible: boolean;
  navLabelPolicy: NavLabelPolicy;
  ctaRestriction: CtaRestriction;
  degradedBehavior: string;
  pageFile: string;
}

export const ROUTE_MATURITY_RULES: readonly RouteMaturityRule[] = [
  {
    route: '/console/overview',
    maturity: 'runtime-degraded',
    runtimeDependency: 'env-auth-backend',
    disclosureRequirement: 'required-banner',
    navEligible: true,
    navLabelPolicy: 'plain',
    ctaRestriction: 'no-runtime-guarantee-claims',
    degradedBehavior: 'Show standby metrics and explicit backend/env dependency text.',
    pageFile: 'ready-layer/src/app/console/overview/page.tsx',
  },
  {
    route: '/console/architecture',
    maturity: 'runtime-degraded',
    runtimeDependency: 'api-status',
    disclosureRequirement: 'required-banner',
    navEligible: true,
    navLabelPolicy: 'plain',
    ctaRestriction: 'no-runtime-guarantee-claims',
    degradedBehavior: 'Render degraded subsystem diagnostics when /api/status is unavailable.',
    pageFile: 'ready-layer/src/app/console/architecture/page.tsx',
  },
  {
    route: '/console/guarantees',
    maturity: 'runtime-degraded',
    runtimeDependency: 'api-status',
    disclosureRequirement: 'required-banner',
    navEligible: true,
    navLabelPolicy: 'plain',
    ctaRestriction: 'no-runtime-guarantee-claims',
    degradedBehavior: 'Bound claims to local verification evidence if backend is unavailable.',
    pageFile: 'ready-layer/src/app/console/guarantees/page.tsx',
  },
  {
    route: '/console/plans',
    maturity: 'demo',
    runtimeDependency: 'api-demo',
    disclosureRequirement: 'required-banner',
    navEligible: true,
    navLabelPolicy: 'append-demo',
    ctaRestriction: 'no-production-claims',
    degradedBehavior: 'Use demo API responses and explain no live plan engine proof.',
    pageFile: 'ready-layer/src/app/console/plans/page.tsx',
  },
  {
    route: '/console/snapshots',
    maturity: 'demo',
    runtimeDependency: 'api-demo',
    disclosureRequirement: 'required-banner',
    navEligible: true,
    navLabelPolicy: 'append-demo',
    ctaRestriction: 'no-production-claims',
    degradedBehavior: 'Use demo API responses and explain no production snapshot orchestration proof.',
    pageFile: 'ready-layer/src/app/console/snapshots/page.tsx',
  },
  {
    route: '/console/replication',
    maturity: 'informational',
    runtimeDependency: 'none',
    disclosureRequirement: 'required-banner',
    navEligible: true,
    navLabelPolicy: 'append-info',
    ctaRestriction: 'no-live-verbs',
    degradedBehavior: 'Remain static and explicit that no live multi-region telemetry is attached.',
    pageFile: 'ready-layer/src/app/console/replication/page.tsx',
  },
  {
    route: '/demo',
    maturity: 'demo',
    runtimeDependency: 'none',
    disclosureRequirement: 'required-banner',
    navEligible: false,
    navLabelPolicy: 'append-demo',
    ctaRestriction: 'no-production-claims',
    degradedBehavior: 'Run local scripted events only; do not imply backend execution authority.',
    pageFile: 'ready-layer/src/app/demo/page.tsx',
  },
] as const;

const ROUTE_MATURITY_BY_ROUTE = new Map(ROUTE_MATURITY_RULES.map((rule) => [rule.route, rule]));

export function getRouteMaturityRule(route: string): RouteMaturityRule | undefined {
  return ROUTE_MATURITY_BY_ROUTE.get(route);
}

export function applyNavLabelPolicy(baseLabel: string, policy: NavLabelPolicy): string {
  if (policy === 'append-demo') return `${baseLabel} (demo)`;
  if (policy === 'append-info') return `${baseLabel} (info)`;
  return baseLabel;
}
