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

export function currentDeploymentTopology(productionLike: boolean, externalRuntimeConfigured = false): SupportedTopology {
  if (!productionLike) {
    return LOCAL_DEVELOPMENT_TOPOLOGY;
  }
  return externalRuntimeConfigured
    ? EXTERNAL_RUNTIME_DEPLOYMENT_TOPOLOGY
    : SUPPORTED_DEPLOYMENT_TOPOLOGY;
}
