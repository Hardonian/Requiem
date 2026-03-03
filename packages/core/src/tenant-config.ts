export interface TenantBig4Config {
  tenant_id: string;
  flags: Partial<Record<'BIG4_REPLAY' | 'BIG4_REGISTRY' | 'BIG4_SPEND' | 'BIG4_DRIFT', boolean>>;
  spend_limit_daily?: number;
}

const config = new Map<string, TenantBig4Config>();

export function setTenantConfig(value: TenantBig4Config): void {
  config.set(value.tenant_id, value);
}

export function getTenantConfig(tenantId: string): TenantBig4Config | undefined {
  return config.get(tenantId);
}
