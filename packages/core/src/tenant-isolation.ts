/**
 * Multi-Tenant Isolation
 *
 * Enforces strict tenant boundaries across all subsystems:
 *   - Scoped storage (CAS, event log, audit)
 *   - Queue partitions
 *   - Rate limits
 *   - Encryption key isolation
 *   - No cross-tenant artifact access
 */

import { blake3Hex } from './hash.js';

// ---------------------------------------------------------------------------
// Tenant Types
// ---------------------------------------------------------------------------

export interface TenantConfig {
  tenant_id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  storage_quota_bytes: number;
  rate_limit_rpm: number;
  daily_spend_limit: number;
  encryption_key_id?: string;
  allowed_tools: string[];
  blocked_tools: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantQuotaUsage {
  tenant_id: string;
  storage_used_bytes: number;
  requests_this_minute: number;
  spend_today: number;
  runs_today: number;
  cas_objects: number;
  active_workers: number;
}

export interface TenantIsolationViolation {
  violation_id: string;
  timestamp: string;
  source_tenant: string;
  target_tenant: string;
  resource_type: 'cas_object' | 'event' | 'run' | 'policy' | 'artifact';
  resource_id: string;
  action: string;
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// Tenant Isolation Guard
// ---------------------------------------------------------------------------

export class TenantIsolationGuard {
  private configs: Map<string, TenantConfig> = new Map();
  private usage: Map<string, TenantQuotaUsage> = new Map();
  private violations: TenantIsolationViolation[] = [];

  /** Register a tenant */
  registerTenant(config: TenantConfig): void {
    this.configs.set(config.tenant_id, config);
    this.usage.set(config.tenant_id, {
      tenant_id: config.tenant_id,
      storage_used_bytes: 0,
      requests_this_minute: 0,
      spend_today: 0,
      runs_today: 0,
      cas_objects: 0,
      active_workers: 0,
    });
  }

  /** Check if a tenant can access a resource */
  canAccess(tenantId: string, resourceTenantId: string, resourceType: string, action: string): boolean {
    if (tenantId === resourceTenantId) return true;

    // Cross-tenant access is ALWAYS denied
    this.violations.push({
      violation_id: `viol_${blake3Hex(tenantId + resourceTenantId + Date.now().toString()).substring(0, 16)}`,
      timestamp: new Date().toISOString(),
      source_tenant: tenantId,
      target_tenant: resourceTenantId,
      resource_type: resourceType as TenantIsolationViolation['resource_type'],
      resource_id: '',
      action,
      blocked: true,
    });
    return false;
  }

  /** Check if tenant is within rate limit */
  checkRateLimit(tenantId: string): { allowed: boolean; remaining: number } {
    const config = this.configs.get(tenantId);
    const usageData = this.usage.get(tenantId);
    if (!config || !usageData) {
      return { allowed: false, remaining: 0 };
    }

    usageData.requests_this_minute++;
    const remaining = Math.max(0, config.rate_limit_rpm - usageData.requests_this_minute);
    return {
      allowed: usageData.requests_this_minute <= config.rate_limit_rpm,
      remaining,
    };
  }

  /** Check if tenant is within storage quota */
  checkStorageQuota(tenantId: string, additionalBytes: number): { allowed: boolean; remaining: number } {
    const config = this.configs.get(tenantId);
    const usageData = this.usage.get(tenantId);
    if (!config || !usageData) {
      return { allowed: false, remaining: 0 };
    }

    const afterUsage = usageData.storage_used_bytes + additionalBytes;
    return {
      allowed: afterUsage <= config.storage_quota_bytes,
      remaining: Math.max(0, config.storage_quota_bytes - afterUsage),
    };
  }

  /** Check if tenant is within daily spend limit */
  checkSpendLimit(tenantId: string, additionalCost: number): { allowed: boolean; remaining: number } {
    const config = this.configs.get(tenantId);
    const usageData = this.usage.get(tenantId);
    if (!config || !usageData) {
      return { allowed: false, remaining: 0 };
    }

    const afterSpend = usageData.spend_today + additionalCost;
    return {
      allowed: afterSpend <= config.daily_spend_limit,
      remaining: Math.max(0, config.daily_spend_limit - afterSpend),
    };
  }

  /** Check if a tool is allowed for this tenant */
  isToolAllowed(tenantId: string, toolId: string): boolean {
    const config = this.configs.get(tenantId);
    if (!config) return false;

    if (config.blocked_tools.includes(toolId)) return false;
    if (config.allowed_tools.length > 0 && !config.allowed_tools.includes(toolId)) return false;
    return true;
  }

  /** Record usage increment */
  recordUsage(tenantId: string, update: Partial<TenantQuotaUsage>): void {
    const usageData = this.usage.get(tenantId);
    if (!usageData) return;

    if (update.storage_used_bytes) usageData.storage_used_bytes += update.storage_used_bytes;
    if (update.spend_today) usageData.spend_today += update.spend_today;
    if (update.runs_today) usageData.runs_today += update.runs_today;
    if (update.cas_objects) usageData.cas_objects += update.cas_objects;
  }

  /** Get tenant usage */
  getUsage(tenantId: string): TenantQuotaUsage | undefined {
    return this.usage.get(tenantId);
  }

  /** Get isolation violations */
  getViolations(tenantId?: string): TenantIsolationViolation[] {
    if (tenantId) {
      return this.violations.filter(v => v.source_tenant === tenantId || v.target_tenant === tenantId);
    }
    return this.violations;
  }

  /** Scope a CAS path by tenant */
  scopeCasPath(tenantId: string, basePath: string): string {
    return `${basePath}/tenants/${tenantId}/cas`;
  }

  /** Scope an event log path by tenant */
  scopeEventLogPath(tenantId: string, basePath: string): string {
    return `${basePath}/tenants/${tenantId}/events`;
  }

  /** Reset per-minute rate limit counters */
  resetMinuteCounters(): void {
    for (const usageData of this.usage.values()) {
      usageData.requests_this_minute = 0;
    }
  }

  /** Reset daily counters */
  resetDailyCounters(): void {
    for (const usageData of this.usage.values()) {
      usageData.spend_today = 0;
      usageData.runs_today = 0;
    }
  }
}
