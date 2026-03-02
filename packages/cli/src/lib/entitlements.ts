/**
 * Entitlements System
 * 
 * Enforceable feature gating and quota management.
 * Integrates with Policy Engine (single choke point).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../core/index.js';

// Entitlement sources
export type EntitlementSource = 'config' | 'token' | 'environment';

// Feature flags
export interface FeatureGates {
  // Core features
  replication: boolean;
  arbitrationAutoMode: boolean;
  signingRequired: boolean;
  
  // Limits
  maxExportSizeBytes: number;
  maxRunRetentionDays: number;
  maxConcurrency: number;
  
  // Premium features
  multiRegion: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
}

// Entitlements interface
export interface Entitlements {
  source: EntitlementSource;
  tier: 'oss' | 'pro' | 'enterprise' | 'custom';
  validUntil?: string;
  features: FeatureGates;
  quotas: {
    runsPerMonth: number;
    decisionsPerMonth: number;
    storageBytes: number;
  };
}

// Default OSS entitlements
const DEFAULT_OSS_ENTITLEMENTS: Entitlements = {
  source: 'config',
  tier: 'oss',
  features: {
    replication: false,
    arbitrationAutoMode: false,
    signingRequired: false,
    maxExportSizeBytes: 10 * 1024 * 1024, // 10MB
    maxRunRetentionDays: 90,
    maxConcurrency: 1,
    multiRegion: false,
    advancedAnalytics: false,
    prioritySupport: false,
  },
  quotas: {
    runsPerMonth: 1000,
    decisionsPerMonth: 10000,
    storageBytes: 100 * 1024 * 1024, // 100MB
  },
};

// Pro tier entitlements
const PRO_ENTITLEMENTS: Entitlements = {
  source: 'config',
  tier: 'pro',
  features: {
    replication: true,
    arbitrationAutoMode: true,
    signingRequired: true,
    maxExportSizeBytes: 100 * 1024 * 1024, // 100MB
    maxRunRetentionDays: 365,
    maxConcurrency: 10,
    multiRegion: true,
    advancedAnalytics: true,
    prioritySupport: false,
  },
  quotas: {
    runsPerMonth: 10000,
    decisionsPerMonth: 100000,
    storageBytes: 1024 * 1024 * 1024, // 1GB
  },
};

// Enterprise tier entitlements
const ENTERPRISE_ENTITLEMENTS: Entitlements = {
  source: 'config',
  tier: 'enterprise',
  features: {
    replication: true,
    arbitrationAutoMode: true,
    signingRequired: true,
    maxExportSizeBytes: 1024 * 1024 * 1024, // 1GB
    maxRunRetentionDays: 1825, // 5 years
    maxConcurrency: 100,
    multiRegion: true,
    advancedAnalytics: true,
    prioritySupport: true,
  },
  quotas: {
    runsPerMonth: 1000000,
    decisionsPerMonth: 10000000,
    storageBytes: 100 * 1024 * 1024 * 1024, // 100GB
  },
};

let cachedEntitlements: Entitlements | null = null;

/**
 * Load entitlements from config.toml
 */
export function loadEntitlements(): Entitlements {
  if (cachedEntitlements) {
    return cachedEntitlements;
  }

  const configPath = join(homedir(), '.requiem', 'config.toml');
  
  // Try to load from config file
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      
      // Parse tier from config
      const tierMatch = content.match(/tier\s*=\s*["']([^"']+)["']/);
      const tier = tierMatch?.[1] as Entitlements['tier'] || 'oss';
      
      // Parse custom feature overrides
      const featureOverrides: Partial<FeatureGates> = {};
      
      const replicationMatch = content.match(/replication\s*=\s*(true|false)/);
      if (replicationMatch) {
        featureOverrides.replication = replicationMatch[1] === 'true';
      }
      
      const arbitrationMatch = content.match(/arbitration_auto_mode\s*=\s*(true|false)/);
      if (arbitrationMatch) {
        featureOverrides.arbitrationAutoMode = arbitrationMatch[1] === 'true';
      }
      
      const signingMatch = content.match(/signing_required\s*=\s*(true|false)/);
      if (signingMatch) {
        featureOverrides.signingRequired = signingMatch[1] === 'true';
      }
      
      // Get base entitlements for tier
      let base: Entitlements;
      switch (tier) {
        case 'pro':
          base = { ...PRO_ENTITLEMENTS };
          break;
        case 'enterprise':
          base = { ...ENTERPRISE_ENTITLEMENTS };
          break;
        default:
          base = { ...DEFAULT_OSS_ENTITLEMENTS };
      }
      
      // Apply overrides
      base.features = { ...base.features, ...featureOverrides };
      base.source = 'config';
      
      cachedEntitlements = base;
      return base;
      
    } catch (error) {
      logger.warn('entitlements.config_parse_failed', 'Failed to parse config.toml, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // Check environment variables
  const envTier = process.env.REQUIEM_TIER as Entitlements['tier'];
  if (envTier === 'pro' || envTier === 'enterprise') {
    cachedEntitlements = envTier === 'pro' ? { ...PRO_ENTITLEMENTS } : { ...ENTERPRISE_ENTITLEMENTS };
    cachedEntitlements.source = 'environment';
    return cachedEntitlements;
  }
  
  // Return default OSS entitlements
  cachedEntitlements = { ...DEFAULT_OSS_ENTITLEMENTS };
  return cachedEntitlements;
}

/**
 * Clear entitlements cache (for testing)
 */
export function clearEntitlementsCache(): void {
  cachedEntitlements = null;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureGates): boolean {
  const entitlements = loadEntitlements();
  const value = entitlements.features[feature];
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  return false;
}

/**
 * Check if feature is enabled or throw
 */
export function requireFeature(feature: keyof FeatureGates, context?: string): void {
  if (!isFeatureEnabled(feature)) {
    const error = new Error(
      `Feature '${feature}' is not enabled in your tier. ` +
      `Upgrade to access this feature.` +
      (context ? ` Context: ${context}` : '')
    );
    (error as Error & { code: string }).code = 'E_FEATURE_NOT_ENABLED';
    throw error;
  }
}

/**
 * Get quota limit
 */
export function getQuota(quota: keyof Entitlements['quotas']): number {
  const entitlements = loadEntitlements();
  return entitlements.quotas[quota];
}

/**
 * Check if within quota
 */
export function checkQuota(quota: keyof Entitlements['quotas'], used: number): {
  allowed: boolean;
  remaining: number;
  limit: number;
} {
  const limit = getQuota(quota);
  const remaining = Math.max(0, limit - used);
  
  return {
    allowed: used < limit,
    remaining,
    limit,
  };
}

/**
 * Get current entitlements summary
 */
export function getEntitlementsSummary(): {
  tier: string;
  source: string;
  features: string[];
  quotas: Record<string, { limit: number; unit: string }>;
} {
  const entitlements = loadEntitlements();
  
  const enabledFeatures = Object.entries(entitlements.features)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  
  return {
    tier: entitlements.tier,
    source: entitlements.source,
    features: enabledFeatures,
    quotas: {
      runsPerMonth: { limit: entitlements.quotas.runsPerMonth, unit: 'runs' },
      decisionsPerMonth: { limit: entitlements.quotas.decisionsPerMonth, unit: 'decisions' },
      storageBytes: { limit: entitlements.quotas.storageBytes, unit: 'bytes' },
    },
  };
}

/**
 * Policy gate integration - checks entitlements before allowing operation
 */
export function policyGate(
  operation: 'replication' | 'arbitration_auto' | 'signing' | 'export',
  params?: { exportSizeBytes?: number }
): { allowed: boolean; reason?: string } {
  const entitlements = loadEntitlements();
  
  switch (operation) {
    case 'replication':
      if (!entitlements.features.replication) {
        return { allowed: false, reason: 'Replication not enabled in current tier' };
      }
      return { allowed: true };
      
    case 'arbitration_auto':
      if (!entitlements.features.arbitrationAutoMode) {
        return { allowed: false, reason: 'Auto arbitration mode requires Pro tier or higher' };
      }
      return { allowed: true };
      
    case 'signing':
      if (entitlements.features.signingRequired) {
        // Signing is required - check if available
        // (actual signing check happens elsewhere)
        return { allowed: true };
      }
      return { allowed: true };
      
    case 'export':
      if (params?.exportSizeBytes && params.exportSizeBytes > entitlements.features.maxExportSizeBytes) {
        return {
          allowed: false,
          reason: `Export size (${params.exportSizeBytes} bytes) exceeds tier limit (${entitlements.features.maxExportSizeBytes} bytes)`,
        };
      }
      return { allowed: true };
      
    default:
      return { allowed: false, reason: 'Unknown operation' };
  }
}
