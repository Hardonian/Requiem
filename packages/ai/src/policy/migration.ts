/**
 * @fileoverview Migration policy runtime check.
 *
 * Loads contracts/migration.policy.json and validates whether a version
 * transition (fromVersion → toVersion) is explicitly listed in any of the
 * migration arrays defined in the policy file.
 *
 * INVARIANT: Only transitions that appear in the policy are permitted.
 * INVARIANT: Unknown transitions are denied with a structured reason.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Policy shape (subset we care about) ─────────────────────────────────────

interface MigrationEntry {
  from_version: number | string;
  to_version:   number | string;
  description?: string;
  migration_script?: string;
  documented_in?: string;
  status?: string;
}

interface MigrationPolicy {
  policy_version: string;
  cas_migrations?:      MigrationEntry[];
  protocol_migrations?: MigrationEntry[];
  db_migrations?:       MigrationEntry[];
  bump_procedure?: {
    steps: string[];
    compatibility_requirement?: string;
    rollback_requirement?: string;
  };
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface MigrationCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  /** The migration_script field from the matching entry, if present. */
  readonly procedure?: string;
}

// ─── Policy loader ────────────────────────────────────────────────────────────

let _policy: MigrationPolicy | null = null;

function loadPolicy(): MigrationPolicy {
  if (_policy) return _policy;

  // Resolve relative to this source file's location so it works regardless
  // of CWD at test/runtime.
  const policyPath = join(__dirname, '../../../../contracts/migration.policy.json');
  const raw = readFileSync(policyPath, 'utf-8');
  _policy = JSON.parse(raw) as MigrationPolicy;
  return _policy;
}

/** Exposed only for test isolation — resets the cached policy. */
export function _resetPolicyCache(): void {
  _policy = null;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Check whether a version transition is approved by the migration policy.
 *
 * @param fromVersion - the source version (string or numeric as string)
 * @param toVersion   - the target version (string or numeric as string)
 * @returns MigrationCheckResult with allowed:true and the procedure if found,
 *          or allowed:false with a human-readable reason.
 *
 * @example
 *   checkMigrationPolicy('1', '2')
 *   // => { allowed: true, procedure: 'requiem migrate cas' }
 *
 *   checkMigrationPolicy('3', '5')
 *   // => { allowed: false, reason: 'Migration from 3 to 5 not in approved transition list' }
 */
export function checkMigrationPolicy(
  fromVersion: string,
  toVersion: string,
): MigrationCheckResult {
  const policy = loadPolicy();

  // Collect all migration arrays
  const allMigrations: MigrationEntry[] = [
    ...(policy.cas_migrations      ?? []),
    ...(policy.protocol_migrations ?? []),
    ...(policy.db_migrations       ?? []),
  ];

  // Normalise for comparison: cast everything to string
  const from = String(fromVersion);
  const to   = String(toVersion);

  const match = allMigrations.find(
    m => String(m.from_version) === from && String(m.to_version) === to
  );

  if (!match) {
    return {
      allowed: false,
      reason: `Migration from ${from} to ${to} not in approved transition list`,
    };
  }

  return {
    allowed: true,
    procedure: match.migration_script,
  };
}
