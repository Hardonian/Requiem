const FLAGS = ['BIG4_REPLAY', 'BIG4_REGISTRY', 'BIG4_SPEND', 'BIG4_DRIFT'] as const;
export type Big4Flag = typeof FLAGS[number];

export function isFeatureEnabled(flag: Big4Flag, tenantOverrides?: Record<string, boolean>): boolean {
  if (tenantOverrides && flag in tenantOverrides) return Boolean(tenantOverrides[flag]);
  return process.env[flag] === '1' || process.env[flag] === 'true';
}

export function listBig4Flags(): readonly Big4Flag[] {
  return FLAGS;
}
