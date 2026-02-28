/**
 * @fileoverview Feature flag runtime module for the Requiem AI control-plane.
 *
 * Loads flag configuration from flags/flags.registry.json, applies enterprise
 * gating (REQUIEM_ENTERPRISE env var), and supports per-flag env overrides.
 *
 * INVARIANT: Enterprise flags are always false unless REQUIEM_ENTERPRISE=true.
 * INVARIANT: Flags never affect deterministic computation — only gate dispatch.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeatureFlags {
  // Kill switches (oss)
  kill_switch_protocol_writer: boolean;
  kill_switch_cas_writer: boolean;

  // Enterprise features
  enable_multi_region_replication: boolean;
  enable_signed_replay_bundles: boolean;
  enable_economic_quotas: boolean;
  enable_merkle_audit_chain: boolean;

  // Internal / CI-only
  enable_chaos_testing: boolean;
  enable_formal_spec_runtime_assertions: boolean;

  // Compliance (oss)
  enable_soft_delete: boolean;
}

interface RegistryFlag {
  id: string;
  type: string;
  tier: string;
  default: boolean;
  status: string;
  description: string;
}

interface FlagRegistry {
  flags: RegistryFlag[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let _cachedFlags: FeatureFlags | null = null;

/** Reset the flag cache (for testing only). */
export function _resetFlagCache(): void {
  _cachedFlags = null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isEnterpriseEnabled(): boolean {
  return process.env['REQUIEM_ENTERPRISE'] === 'true';
}

function resolveFlag(flag: RegistryFlag, isEnterprise: boolean): boolean {
  const envKey = `REQUIEM_FLAG_${flag.id.toUpperCase()}`;
  const envOverride = process.env[envKey];

  // Enterprise-tier flags are always false in OSS mode, regardless of env override
  if (flag.tier === 'enterprise' && !isEnterprise) {
    return false;
  }

  if (envOverride === 'true') return true;
  if (envOverride === 'false') return false;

  return flag.default;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load and resolve the full feature flag set.
 * Results are cached for the process lifetime. Call _resetFlagCache() to clear.
 */
export function loadFlags(): FeatureFlags {
  if (_cachedFlags) return _cachedFlags;

  const isEnterprise = isEnterpriseEnabled();
  let registry: FlagRegistry;

  try {
    // Resolve registry path relative to workspace root (3 levels up from src/flags/)
    const registryPath = join(
      new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), // Windows compat
      '..', '..', '..', '..', '..', '..', 'flags', 'flags.registry.json'
    );
    const raw = readFileSync(registryPath, 'utf8');
    registry = JSON.parse(raw) as FlagRegistry;
  } catch {
    // Fallback: all flags default to false if registry is unreadable
    registry = { flags: [] };
  }

  const resolved: Record<string, boolean> = {};
  for (const flag of registry.flags) {
    resolved[flag.id] = resolveFlag(flag, isEnterprise);
  }

  _cachedFlags = {
    kill_switch_protocol_writer: resolved['kill_switch_protocol_writer'] ?? false,
    kill_switch_cas_writer: resolved['kill_switch_cas_writer'] ?? false,
    enable_multi_region_replication: resolved['enable_multi_region_replication'] ?? false,
    enable_signed_replay_bundles: resolved['enable_signed_replay_bundles'] ?? false,
    enable_economic_quotas: resolved['enable_economic_quotas'] ?? false,
    enable_merkle_audit_chain: resolved['enable_merkle_audit_chain'] ?? false,
    enable_chaos_testing: resolved['enable_chaos_testing'] ?? false,
    enable_formal_spec_runtime_assertions: resolved['enable_formal_spec_runtime_assertions'] ?? false,
    enable_soft_delete: resolved['enable_soft_delete'] ?? false,
  };

  return _cachedFlags;
}

/**
 * Assert that enterprise license is active.
 * Throws if REQUIEM_ENTERPRISE !== "true".
 * @throws Error with message "Enterprise license required for feature: {featureName}"
 */
export function requireEnterprise(featureName: string): void {
  if (!isEnterpriseEnabled()) {
    throw new Error(`Enterprise license required for feature: ${featureName}`);
  }
}

/**
 * Check if a kill switch flag is currently active.
 * Returns true if the kill switch is engaged (flag is true).
 */
export function isKillSwitchActive(switchName: string): boolean {
  const flags = loadFlags();
  const key = switchName as keyof FeatureFlags;
  return flags[key] === true;
}
