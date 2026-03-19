export const REQUEST_EXECUTION_MODEL = 'request-bound-same-runtime' as const;
export const LOCAL_DEVELOPMENT_TOPOLOGY = 'local-single-runtime' as const;
export const SUPPORTED_DEPLOYMENT_TOPOLOGY = 'supabase-shared-request-bound' as const;
export const TENANCY_MODEL = 'single-user-single-tenant' as const;

export type ExecutionModel = typeof REQUEST_EXECUTION_MODEL;
export type SupportedTopology = typeof LOCAL_DEVELOPMENT_TOPOLOGY | typeof SUPPORTED_DEPLOYMENT_TOPOLOGY;
export type TenancyModel = typeof TENANCY_MODEL;

export function currentDeploymentTopology(productionLike: boolean): SupportedTopology {
  return productionLike ? SUPPORTED_DEPLOYMENT_TOPOLOGY : LOCAL_DEVELOPMENT_TOPOLOGY;
}
