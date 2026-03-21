export const REQUEST_EXECUTION_MODEL = 'request-bound-same-runtime' as const;
export const LOCAL_DEVELOPMENT_TOPOLOGY = 'local-single-runtime' as const;
export const SUPPORTED_DEPLOYMENT_TOPOLOGY = 'shared-supabase-request-bound' as const;
export const EXTERNAL_RUNTIME_DEPLOYMENT_TOPOLOGY = 'shared-supabase-request-bound-external-api' as const;
export const TENANCY_MODEL = 'shared-runtime-multi-tenant-multi-org' as const;

export type ExecutionModel = typeof REQUEST_EXECUTION_MODEL;
export type SupportedTopology =
  | typeof LOCAL_DEVELOPMENT_TOPOLOGY
  | typeof SUPPORTED_DEPLOYMENT_TOPOLOGY
  | typeof EXTERNAL_RUNTIME_DEPLOYMENT_TOPOLOGY;
export type TenancyModel = typeof TENANCY_MODEL;

// ---------------------------------------------------------------------------
// Execution taxonomy — canonical classification for every execution path
// ---------------------------------------------------------------------------

export type DurabilityClass =
  | 'durable-queued'       // persisted before execution; survives process loss; recoverable via lease expiry
  | 'request-bound'        // tied to the HTTP request lifecycle; lost on process death
  | 'externally-delegated' // forwarded to REQUIEM_API_URL; durability depends on external service
  | 'informational'        // read-only or stub; no execution side-effect
  | 'not-implemented';     // surface exists but has no backend execution

export interface ExecutionPathEntry {
  path: string;
  durability_class: DurabilityClass;
  survives_process_loss: boolean;
  duplicate_safe: boolean;
  operator_visible_recovery: boolean;
  notes: string;
}

export const EXECUTION_TAXONOMY: ExecutionPathEntry[] = [
  {
    path: '/api/tenants/jobs (action=enqueue)',
    durability_class: 'durable-queued',
    survives_process_loss: true,
    duplicate_safe: true,
    operator_visible_recovery: true,
    notes: 'Job intent persisted before execution. Lease-based ownership prevents duplicate processing. Stale leases recovered via action=recover or automatically during action=process.',
  },
  {
    path: '/api/tenants/jobs (action=process)',
    durability_class: 'durable-queued',
    survives_process_loss: true,
    duplicate_safe: true,
    operator_visible_recovery: true,
    notes: 'Claims job with time-bounded lease. If worker dies mid-flight, lease expires and job returns to pending or failed. No autonomous background polling — requires explicit operator/worker call.',
  },
  {
    path: '/api/tenants/jobs (action=recover)',
    durability_class: 'durable-queued',
    survives_process_loss: true,
    duplicate_safe: true,
    operator_visible_recovery: true,
    notes: 'Explicitly reclaims stale leases. Idempotent.',
  },
  {
    path: '/api/plans (action=run)',
    durability_class: 'request-bound',
    survives_process_loss: false,
    duplicate_safe: false,
    operator_visible_recovery: false,
    notes: 'Plan execution runs synchronously in the request handler. If the process dies, the run is lost. Use durable job queue for crash-safe plan execution.',
  },
  {
    path: '/api/tenants/organizations',
    durability_class: 'request-bound',
    survives_process_loss: false,
    duplicate_safe: true,
    operator_visible_recovery: false,
    notes: 'CRUD mutations are request-bound but idempotency-keyed. State is persisted atomically within the request. Process death mid-write is protected by atomic file rename or Supabase OCC.',
  },
  {
    path: '/api/engine/*',
    durability_class: 'externally-delegated',
    survives_process_loss: false,
    duplicate_safe: false,
    operator_visible_recovery: false,
    notes: 'Proxied to REQUIEM_API_URL. Durability depends on the external runtime.',
  },
  {
    path: '/api/health, /api/readiness, /api/status',
    durability_class: 'informational',
    survives_process_loss: false,
    duplicate_safe: true,
    operator_visible_recovery: false,
    notes: 'Read-only probes with no side effects.',
  },
];

// ---------------------------------------------------------------------------
// Membership lifecycle truth
// ---------------------------------------------------------------------------

export const MEMBERSHIP_LIFECYCLE = {
  supported: [
    'create organization (admin becomes first member)',
    'set member role (admin can assign admin/operator/viewer to any actor_id)',
    'delete organization (cascades members and jobs)',
    'validate role (check actor role against minimum threshold)',
    'list organizations and memberships for current tenant',
  ],
  not_implemented: [
    'email-based invite with durable token',
    'invite acceptance flow with expiry handling',
    'invite revocation',
    'member deactivation / removal without org deletion',
    'seat accounting or billing integration',
    'self-service role change',
    'org switching UI',
  ],
} as const;

export function currentDeploymentTopology(productionLike: boolean, externalRuntimeConfigured = false): SupportedTopology {
  if (!productionLike) {
    return LOCAL_DEVELOPMENT_TOPOLOGY;
  }
  return externalRuntimeConfigured
    ? EXTERNAL_RUNTIME_DEPLOYMENT_TOPOLOGY
    : SUPPORTED_DEPLOYMENT_TOPOLOGY;
}
