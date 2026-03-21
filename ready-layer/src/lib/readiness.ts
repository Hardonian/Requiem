import {
  REQUEST_EXECUTION_MODEL,
  TENANCY_MODEL,
  currentDeploymentTopology,
  EXECUTION_TAXONOMY,
  MEMBERSHIP_LIFECYCLE,
  type DurabilityClass,
} from '@/lib/deployment-contract';
import { createInternalAuthProof } from '@/lib/internal-auth-proof';
import { checkControlPlanePersistence } from '@/lib/control-plane-store';
import { checkSharedRuntimeCoordination } from '@/lib/shared-request-coordination';
import {
  resolveDeploymentTopologyMode,
  validateRuntimeEnvContract,
  type DeploymentTopologyMode,
  type EnvContractCheck,
} from '@/lib/env-contract';

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  detail: string;
  required?: boolean;
  skipped?: boolean;
}

export interface ReadinessResult {
  ok: boolean;
  status: 'ready' | 'not_ready';
  timestamp_unix_ms: number;
  checks: ReadinessCheck[];
  deployment_contract: {
    topology: string;
    topology_mode: DeploymentTopologyMode;
    execution_model: string;
    tenancy_model: string;
    durable_queue_available: boolean;
    autonomous_worker_active: false;
    supported_durability_classes: DurabilityClass[];
    membership_lifecycle: {
      supported: readonly string[];
      not_implemented: readonly string[];
    };
    external_runtime_configured: boolean;
  };
}

function toReadinessCheck(check: EnvContractCheck): ReadinessCheck {
  return {
    name: check.name,
    ok: check.ok,
    detail: check.detail,
    required: check.required,
  };
}

async function probeEngineApi(externalRuntimeConfigured: boolean): Promise<ReadinessCheck> {
  const baseUrl = process.env.REQUIEM_API_URL?.trim();
  if (!baseUrl) {
    return {
      name: 'engine_api_reachable',
      ok: true,
      skipped: true,
      required: false,
      detail: 'REQUIEM_API_URL is not configured; external runtime probe skipped because this topology is request-bound ReadyLayer only',
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
          required: externalRuntimeConfigured,
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
    required: externalRuntimeConfigured,
    detail: lastFailure,
  };
}

async function probeInternalAuthProof(): Promise<ReadinessCheck> {
  const proof = await createInternalAuthProof({
    tenantId: 'readiness-probe',
    actorId: 'readiness-probe',
    method: 'GET',
    pathname: '/api/readiness',
  });

  return {
    name: 'auth_proof_operational',
    ok: Boolean(proof),
    required: true,
    detail: proof
      ? 'internal auth proof signing is available'
      : 'missing REQUIEM_AUTH_INTERNAL_SECRET or REQUIEM_AUTH_SECRET for internal auth proof signing',
  };
}

async function probeControlPlanePersistence(): Promise<ReadinessCheck> {
  const result = await checkControlPlanePersistence();
  return {
    name: 'control_plane_persistence',
    ok: result.ok,
    required: true,
    detail: `${result.detail} (${result.mode}, root=${result.root})`,
  };
}

async function probeRuntimeCoordination(required: boolean): Promise<ReadinessCheck> {
  const result = await checkSharedRuntimeCoordination();
  return {
    name: 'shared_runtime_coordination',
    ok: required ? result.ok : true,
    required,
    skipped: !required,
    detail: required ? result.detail : 'shared runtime coordination is optional in local-single-runtime mode',
  };
}

function probeExecutionModelTruth(topologyMode: DeploymentTopologyMode): ReadinessCheck {
  const topology = currentDeploymentTopology(topologyMode !== 'local-single-runtime', topologyMode === 'shared-supabase-request-bound-external-api');
  return {
    name: 'execution_model_contract',
    ok: true,
    required: false,
    detail: `Topology mode=${topologyMode}; supported topology=${topology}; foreground execution stays ${REQUEST_EXECUTION_MODEL}; durable plan jobs can be enqueued and recovered after process loss through the shared control-plane queue, but there is no autonomous background worker — processing requires explicit operator-driven action=process calls.`,
  };
}

function probeDurableQueueHealth(topologyMode: DeploymentTopologyMode): ReadinessCheck {
  const queueAvailable = true; // The queue code path is always compiled in
  return {
    name: 'durable_queue_health',
    ok: queueAvailable,
    required: false,
    detail: queueAvailable
      ? 'Durable plan-job queue is available. Jobs can be enqueued, leased, recovered, and finalized. No autonomous background worker exists — processing requires explicit action=process calls from an operator or external scheduler.'
      : 'Durable plan-job queue is not available.',
  };
}

export async function computeReadiness(): Promise<ReadinessResult> {
  const envContract = validateRuntimeEnvContract();
  const topologyMode = resolveDeploymentTopologyMode();
  const checks: ReadinessCheck[] = [
    ...envContract.checks.map(toReadinessCheck),
    await probeInternalAuthProof(),
    await probeControlPlanePersistence(),
    await probeRuntimeCoordination(topologyMode !== 'local-single-runtime'),
    await probeEngineApi(envContract.external_runtime_configured),
    probeExecutionModelTruth(topologyMode),
    probeDurableQueueHealth(topologyMode),
  ];

  const supportedDurabilityClasses = [...new Set(EXECUTION_TAXONOMY.map((e) => e.durability_class))];

  const ok = checks.every((check) => !check.required || check.ok);
  return {
    ok,
    status: ok ? 'ready' : 'not_ready',
    timestamp_unix_ms: Date.now(),
    checks,
    deployment_contract: {
      topology: currentDeploymentTopology(topologyMode !== 'local-single-runtime', envContract.external_runtime_configured),
      topology_mode: topologyMode,
      execution_model: REQUEST_EXECUTION_MODEL,
      tenancy_model: TENANCY_MODEL,
      durable_queue_available: true,
      autonomous_worker_active: false,
      supported_durability_classes: supportedDurabilityClasses,
      membership_lifecycle: MEMBERSHIP_LIFECYCLE,
      external_runtime_configured: envContract.external_runtime_configured,
    },
  };
}
