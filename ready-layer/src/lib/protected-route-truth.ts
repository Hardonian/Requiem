import { routeMaturityByPath, type RouteMaturityRecord } from './route-maturity';

export type ProtectedRouteTruthTone = 'neutral' | 'warning';

export interface ProtectedRouteTruth {
  stateLabel: string;
  title: string;
  detail: string;
  nextStep: string;
  tone: ProtectedRouteTruthTone;
}

function findRouteRecord(pathname: string): RouteMaturityRecord | null {
  if (routeMaturityByPath[pathname]) {
    return routeMaturityByPath[pathname];
  }

  const matchedPrefix = Object.keys(routeMaturityByPath)
    .filter((path) => pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchedPrefix) {
    return null;
  }

  return routeMaturityByPath[matchedPrefix] ?? null;
}

export function classifyProtectedRouteTruth(pathname: string, backendConfigured: boolean): ProtectedRouteTruth {
  const routeRecord = findRouteRecord(pathname);

  if (!routeRecord) {
    return {
      stateLabel: 'source-inspected route',
      title: 'Protected route is authenticated, but route maturity is not declared',
      detail: 'This route is behind middleware auth, but no shared maturity record exists yet. Treat controls as unproven unless route-level evidence is visible on this screen.',
      nextStep: 'Add this route to the shared route maturity catalog before claiming runtime-backed behavior.',
      tone: 'warning',
    };
  }

  if (routeRecord.maturity === 'runtime-backed' && !backendConfigured) {
    return {
      stateLabel: 'backend missing',
      title: 'Runtime-backed route is degraded because backend is not configured',
      detail: 'This route expects runtime data, but REQUIEM_API_URL is missing. Data and mutations are unavailable until backend wiring exists.',
      nextStep: 'Set REQUIEM_API_URL, then reload this route and re-check action states.',
      tone: 'warning',
    };
  }

  return {
    stateLabel: `${routeRecord.maturity} route`,
    title: `${routeRecord.navLabel}: ${routeRecord.summary}`,
    detail: routeRecord.degradedBehavior,
    nextStep: routeRecord.backendRequired
      ? 'Treat controls as runtime-backed only when route-level responses confirm backend reachability and authorization.'
      : 'Use route-level controls according to their semantics label (runtime-backed, local-only, navigation-only, or informational).',
    tone: routeRecord.disclosureRequired || routeRecord.maturity !== 'runtime-backed' ? 'warning' : 'neutral',
  };
}
