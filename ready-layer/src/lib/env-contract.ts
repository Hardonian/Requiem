import { isProductionLikeRuntime } from './runtime-mode';
import { getAuthReadiness } from './auth';
import { getSupabaseServiceConfig } from './supabase-service';

export type DeploymentTopologyMode =
  | 'local-single-runtime'
  | 'shared-supabase-request-bound'
  | 'shared-supabase-request-bound-external-api';

export interface EnvContractCheck {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

export interface RuntimeEnvContract {
  ok: boolean;
  topology_mode: DeploymentTopologyMode;
  external_runtime_configured: boolean;
  checks: EnvContractCheck[];
}

function hasNonEmpty(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function validUrl(value: string | null | undefined): boolean {
  if (!hasNonEmpty(value)) {
    return false;
  }

  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveDeploymentTopologyMode(): DeploymentTopologyMode {
  const externalRuntimeConfigured = hasNonEmpty(process.env.REQUIEM_API_URL);
  if (!isProductionLikeRuntime()) {
    return 'local-single-runtime';
  }
  return externalRuntimeConfigured
    ? 'shared-supabase-request-bound-external-api'
    : 'shared-supabase-request-bound';
}

export function validateRuntimeEnvContract(): RuntimeEnvContract {
  const authReadiness = getAuthReadiness();
  const supabase = getSupabaseServiceConfig();
  const topologyMode = resolveDeploymentTopologyMode();
  const externalRuntimeConfigured = hasNonEmpty(process.env.REQUIEM_API_URL);
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? null;
  const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? null;
  const apiUrl = process.env.REQUIEM_API_URL?.trim() ?? null;
  const productionLike = isProductionLikeRuntime();

  const checks: EnvContractCheck[] = [
    {
      name: 'supabase_public_url',
      ok: validUrl(publicSupabaseUrl),
      required: true,
      detail: validUrl(publicSupabaseUrl)
        ? 'NEXT_PUBLIC_SUPABASE_URL is configured with an http(s) URL'
        : 'NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL for authenticated ReadyLayer deployments',
    },
    {
      name: 'supabase_public_anon_key',
      ok: hasNonEmpty(publicSupabaseAnonKey),
      required: true,
      detail: hasNonEmpty(publicSupabaseAnonKey)
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY is configured'
        : 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required for authenticated ReadyLayer UI and middleware',
    },
    {
      name: 'auth_bearer_secret',
      ok: authReadiness.bearer_secret_present,
      required: true,
      detail: authReadiness.bearer_secret_present
        ? 'REQUIEM_AUTH_SECRET is configured'
        : productionLike || authReadiness.strict_mode
          ? 'REQUIEM_AUTH_SECRET is required for strict/authenticated API mode'
          : 'REQUIEM_AUTH_SECRET is not configured',
    },
    {
      name: 'internal_auth_proof_secret',
      ok: authReadiness.proof_operational,
      required: true,
      detail: authReadiness.proof_operational
        ? 'internal auth proof signing secret is available'
        : 'REQUIEM_AUTH_INTERNAL_SECRET or REQUIEM_AUTH_SECRET is required for internal auth proof signing',
    },
    {
      name: 'shared_supabase_url',
      ok: productionLike ? validUrl(supabase.url) : true,
      required: productionLike,
      detail: productionLike
        ? validUrl(supabase.url)
          ? 'shared Supabase URL is configured for production-like control-plane coordination'
          : 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) must be a valid http(s) URL for production-like shared coordination'
        : 'shared Supabase URL is optional outside production-like deployments',
    },
    {
      name: 'shared_service_role',
      ok: productionLike ? hasNonEmpty(supabase.serviceRoleKey) : true,
      required: productionLike,
      detail: productionLike
        ? hasNonEmpty(supabase.serviceRoleKey)
          ? 'SUPABASE_SERVICE_ROLE_KEY is configured for shared control-plane/idempotency/rate limiting'
          : 'SUPABASE_SERVICE_ROLE_KEY is required for production-like shared control-plane/idempotency/rate limiting'
        : 'SUPABASE_SERVICE_ROLE_KEY is optional outside production-like deployments',
    },
    {
      name: 'external_runtime_url',
      ok: externalRuntimeConfigured ? validUrl(apiUrl) : true,
      required: externalRuntimeConfigured,
      detail: externalRuntimeConfigured
        ? validUrl(apiUrl)
          ? 'REQUIEM_API_URL is configured with an http(s) URL'
          : 'REQUIEM_API_URL is configured but invalid; use a valid http(s) base URL'
        : 'REQUIEM_API_URL is not configured; readiness will evaluate request-bound ReadyLayer only',
    },
  ];

  return {
    ok: checks.every((check) => !check.required || check.ok),
    topology_mode: topologyMode,
    external_runtime_configured: externalRuntimeConfigured,
    checks,
  };
}
