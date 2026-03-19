import { createInternalAuthProof } from '@/lib/internal-auth-proof';
import { getAuthReadiness } from '@/lib/auth';
import { checkControlPlanePersistence } from '@/lib/control-plane-store';

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ReadinessResult {
  ok: boolean;
  status: 'ready' | 'not_ready';
  timestamp_unix_ms: number;
  checks: ReadinessCheck[];
}

async function probeEngineApi(): Promise<ReadinessCheck> {
  const baseUrl = process.env.REQUIEM_API_URL?.trim();
  if (!baseUrl) {
    return {
      name: 'engine_api_reachable',
      ok: true,
      detail: 'REQUIEM_API_URL is not configured; external runtime probe skipped for console-only mode',
    };
  }

  const healthUrls = [`${baseUrl}/api/health`, `${baseUrl}/health`];
  let lastFailure = 'engine health probe failed';

  for (const url of healthUrls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(1_500),
        headers: { 'x-trace-id': `readiness-${Date.now()}` },
        cache: 'no-store',
      });
      if (response.ok) {
        return {
          name: 'engine_api_reachable',
          ok: true,
          detail: `engine health probe succeeded via ${new URL(url).pathname}`,
        };
      }
      lastFailure = `engine health probe returned ${response.status} via ${new URL(url).pathname}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : 'engine health probe failed';
    }
  }

  return {
    name: 'engine_api_reachable',
    ok: false,
    detail: lastFailure,
  };
}

async function probeInternalAuthProof(): Promise<ReadinessCheck> {
  const readiness = getAuthReadiness();
  const proof = await createInternalAuthProof({
    tenantId: 'readiness-probe',
    actorId: 'readiness-probe',
    method: 'GET',
    pathname: '/api/readiness',
  });

  return {
    name: 'auth_proof_operational',
    ok: readiness.proof_operational && Boolean(proof),
    detail:
      readiness.proof_operational && proof
        ? 'internal auth proof signing is available'
        : 'missing REQUIEM_AUTH_INTERNAL_SECRET or REQUIEM_AUTH_SECRET for internal auth proof signing',
  };
}

function probeAuthConfiguration(): ReadinessCheck {
  const readiness = getAuthReadiness();
  return {
    name: 'auth_configuration_present',
    ok: readiness.bearer_secret_present,
    detail: readiness.bearer_secret_present
      ? 'REQUIEM_AUTH_SECRET is configured'
      : readiness.strict_mode
        ? 'strict auth mode requires REQUIEM_AUTH_SECRET'
        : 'REQUIEM_AUTH_SECRET is not configured',
  };
}

function probeControlPlanePersistence(): ReadinessCheck {
  const result = checkControlPlanePersistence();
  return {
    name: 'control_plane_persistence',
    ok: result.ok,
    detail: `${result.detail} (root=${result.root})`,
  };
}

export async function computeReadiness(): Promise<ReadinessResult> {
  const checks = [
    probeAuthConfiguration(),
    await probeInternalAuthProof(),
    probeControlPlanePersistence(),
    await probeEngineApi(),
  ];

  const ok = checks.every((check) => check.ok);
  return {
    ok,
    status: ok ? 'ready' : 'not_ready',
    timestamp_unix_ms: Date.now(),
    checks,
  };
}
