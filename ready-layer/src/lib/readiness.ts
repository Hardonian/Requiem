import {
  REQUEST_EXECUTION_MODEL,
  TENANCY_MODEL,
  currentDeploymentTopology,
} from '@/lib/deployment-contract';
import { createInternalAuthProof } from '@/lib/internal-auth-proof';
import { getAuthReadiness } from '@/lib/auth';
import { checkControlPlanePersistence } from '@/lib/control-plane-store';
import { isProductionLikeRuntime } from '@/lib/runtime-mode';
import { checkSharedRuntimeCoordination } from '@/lib/shared-request-coordination';

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
  deployment_contract: {
    topology: string;
    execution_model: string;
    tenancy_model: string;
    background_execution_supported: false;
  };
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

async function probeControlPlanePersistence(): Promise<ReadinessCheck> {
  const result = await checkControlPlanePersistence();
  return {
    name: 'control_plane_persistence',
    ok: result.ok,
    detail: `${result.detail} (${result.mode}, root=${result.root})`,
  };
}

async function probeRuntimeCoordination(): Promise<ReadinessCheck> {
  const result = await checkSharedRuntimeCoordination();
  return {
    name: 'shared_runtime_coordination',
    ok: result.ok,
    detail: result.detail,
  };
}

function probeExecutionModelTruth(): ReadinessCheck {
  const topology = currentDeploymentTopology(isProductionLikeRuntime());
  return {
    name: 'execution_model_contract',
    ok: true,
    detail: `Supported topology=${topology}; execution stays ${REQUEST_EXECUTION_MODEL}; no durable background continuation is provided after process loss.`,
  };
}

export async function computeReadiness(): Promise<ReadinessResult> {
  const productionLike = isProductionLikeRuntime();
  const checks = [
    probeAuthConfiguration(),
    await probeInternalAuthProof(),
    await probeControlPlanePersistence(),
    await probeRuntimeCoordination(),
    await probeEngineApi(),
    probeExecutionModelTruth(),
  ];

  const ok = checks.every((check) => check.ok || check.name === 'execution_model_contract');
  return {
    ok,
    status: ok ? 'ready' : 'not_ready',
    timestamp_unix_ms: Date.now(),
    checks,
    deployment_contract: {
      topology: currentDeploymentTopology(productionLike),
      execution_model: REQUEST_EXECUTION_MODEL,
      tenancy_model: TENANCY_MODEL,
      background_execution_supported: false,
    },
  };
}
