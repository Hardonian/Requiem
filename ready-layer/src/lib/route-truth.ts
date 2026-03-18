export type RouteTruthKind =
  | 'backend-missing'
  | 'backend-unreachable'
  | 'forbidden'
  | 'no-data'
  | 'engine-unavailable'
  | 'auth-required'
  | 'unknown';

export interface RouteTruthClassification {
  kind: RouteTruthKind;
  title: string;
  detail: string;
  nextStep: string;
}

const ENGINE_UNAVAILABLE_CODES = new Set([
  'engine_metrics_unavailable',
  'engine_analyze_unavailable',
  'autotune_unavailable',
  'engine_diagnostics_unavailable',
  'engine_status_unavailable',
]);

export function classifyApiFailure(input: { status?: number; code?: string | null; message?: string | null }): RouteTruthClassification {
  const status = input.status ?? 0;
  const code = (input.code ?? '').toLowerCase();
  const message = (input.message ?? '').toLowerCase();

  if (code === 'control_plane_store_unconfigured' || code === 'shared_runtime_coordination_unconfigured') {
    return {
      kind: 'backend-missing',
      title: 'Shared runtime state missing',
      detail: 'Production-like deployments require shared Supabase-backed state for control-plane persistence and request coordination.',
      nextStep: 'Configure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY, then retry.',
    };
  }

  if (code === 'auth_secret_required') {
    return {
      kind: 'backend-missing',
      title: 'Auth runtime secret missing',
      detail: 'REQUIEM_AUTH_SECRET is required for strict authenticated runtime checks.',
      nextStep: 'Set REQUIEM_AUTH_SECRET and restart the app to restore runtime-backed auth checks.',
    };
  }

  if (code === 'backend_unconfigured' || message.includes('requiem_api_url')) {
    return {
      kind: 'backend-missing',
      title: 'Backend dependency missing',
      detail: 'REQUIEM_API_URL is not configured, so runtime-backed data cannot be queried.',
      nextStep: 'Set REQUIEM_API_URL to a reachable Requiem API endpoint.',
    };
  }

  if (status === 401) {
    return {
      kind: 'auth-required',
      title: 'Authentication required',
      detail: 'The request was rejected because no valid authenticated session was present.',
      nextStep: 'Sign in with a real user session, or use explicit dev verify mode for local-only route checks.',
    };
  }

  if (status === 403 || code.includes('forbidden')) {
    return {
      kind: 'forbidden',
      title: 'Forbidden',
      detail: 'You are authenticated but not authorized for this operation in the current tenant/context.',
      nextStep: 'Use an authorized account or adjust policy bindings for this tenant.',
    };
  }

  if (status === 404 || code.includes('not_found') || message.includes('no data')) {
    return {
      kind: 'no-data',
      title: 'No data available',
      detail: 'The route is reachable, but no matching records were returned.',
      nextStep: 'Generate data for this route, then refresh.',
    };
  }

  if (ENGINE_UNAVAILABLE_CODES.has(code) || code.includes('engine') || message.includes('engine') || message.includes('binary')) {
    return {
      kind: 'engine-unavailable',
      title: 'Engine runtime unavailable',
      detail: 'The route depends on an engine/runtime binary that is not available or not reachable.',
      nextStep: 'Start or repair the engine/runtime dependency, then retry.',
    };
  }

  if (status === 502 || status === 503 || status === 504 || code.includes('unavailable') || message.includes('network')) {
    return {
      kind: 'backend-unreachable',
      title: 'Backend unreachable',
      detail: 'Backend is configured, but the API call failed at runtime.',
      nextStep: 'Check backend process health and network reachability, then retry.',
    };
  }

  return {
    kind: 'unknown',
    title: 'Runtime request failed',
    detail: 'The request failed, but failure class could not be determined from response metadata.',
    nextStep: 'Inspect server logs and trace IDs for root cause before treating this as healthy.',
  };
}
