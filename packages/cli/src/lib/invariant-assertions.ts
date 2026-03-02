/**
 * Runtime Invariant Assertion Layer
 *
 * Lightweight runtime assertions for critical invariants.
 * - Active in dev mode (REQUIEM_ASSERTIONS=true or NODE_ENV !== 'production')
 * - Never affect determinism (no side effects on passing path)
 * - Fail fast with structured error codes
 * - Never leak secrets
 *
 * INVARIANT: Assertions must not mutate state.
 * INVARIANT: Assertions must not introduce non-determinism.
 * INVARIANT: Assertions must use structured RequiemError on failure.
 */

import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

// ─── Configuration ──────────────────────────────────────────────────────────────

/**
 * Whether assertions are active. Controlled by:
 *   REQUIEM_ASSERTIONS=true  → enabled
 *   NODE_ENV=production      → disabled (unless REQUIEM_ASSERTIONS=true)
 *   Everything else          → enabled
 */
function assertionsEnabled(): boolean {
  if (process.env.REQUIEM_ASSERTIONS === 'true') return true;
  if (process.env.REQUIEM_ASSERTIONS === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

// ─── Core assertion functions ───────────────────────────────────────────────────

export type InvariantCode =
  | 'INV_FINGERPRINT_MISMATCH'
  | 'INV_LEDGER_COUNT_MISMATCH'
  | 'INV_MANIFEST_MISSING_CAS'
  | 'INV_REPLAY_MUTATION'
  | 'INV_POLICY_MISSING'
  | 'INV_COST_BEFORE_COMMIT'
  | 'INV_STATE_REGRESSION'
  | 'INV_STATE_SKIP'
  | 'INV_SIGNATURE_MISMATCH'
  | 'INV_TENANT_LEAK'
  | 'INV_CAS_INTEGRITY'
  | 'INV_CLOCK_VIOLATION'
  | 'INV_ARBITRATION_BEFORE_EXECUTE'
  | 'INV_POLICY_BEFORE_EXECUTE';

/**
 * Assert an invariant condition. If the condition is false, throws a
 * structured RequiemError with the given invariant code.
 *
 * No-op in production unless REQUIEM_ASSERTIONS=true.
 */
export function assertInvariant(
  condition: boolean,
  code: InvariantCode,
  message: string,
  context?: Record<string, unknown>,
): asserts condition {
  if (!assertionsEnabled()) return;
  if (condition) return;

  throw new RequiemError({
    code: ErrorCode.INVARIANT_VIOLATION,
    message: `Invariant violation [${code}]: ${message}`,
    severity: ErrorSeverity.CRITICAL,
    retryable: false,
    phase: 'invariant_check',
    meta: context ? { context: sanitizeContext(context) } : undefined,
  });
}

/**
 * Assert two values are strictly equal.
 */
export function assertEqual<T>(
  actual: T,
  expected: T,
  code: InvariantCode,
  message: string,
): void {
  assertInvariant(
    actual === expected,
    code,
    `${message} (expected: ${truncate(String(expected))}, got: ${truncate(String(actual))})`,
  );
}

/**
 * Assert a value is not null/undefined.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  code: InvariantCode,
  message: string,
): asserts value is T {
  assertInvariant(value !== null && value !== undefined, code, message);
}

/**
 * Assert a hex digest is well-formed (64 lowercase hex chars).
 */
export function assertValidDigest(
  digest: string,
  code: InvariantCode,
  label: string,
): void {
  assertInvariant(
    /^[a-f0-9]{64}$/.test(digest),
    code,
    `${label} is not a valid 64-char hex digest: "${truncate(digest)}"`,
  );
}

// ─── Domain-specific assertions ─────────────────────────────────────────────────

/**
 * Assert that a fingerprint matches expected value on replay.
 */
export function assertFingerprintMatch(
  computed: string,
  stored: string,
  runId: string,
): void {
  assertEqual(
    computed,
    stored,
    'INV_FINGERPRINT_MISMATCH',
    `Fingerprint mismatch during replay of run ${truncate(runId)}`,
  );
}

/**
 * Assert that ledger entry count matches expected for a run.
 */
export function assertLedgerCount(
  actual: number,
  expected: number,
  runId: string,
): void {
  assertEqual(
    actual,
    expected,
    'INV_LEDGER_COUNT_MISMATCH',
    `Ledger entry count mismatch for run ${truncate(runId)}`,
  );
}

/**
 * Assert that a CAS reference exists (is not null/missing).
 */
export function assertCASBlobExists(
  exists: boolean,
  digest: string,
): void {
  assertInvariant(
    exists,
    'INV_MANIFEST_MISSING_CAS',
    `Manifest references missing CAS blob: ${truncate(digest)}`,
  );
}

/**
 * Assert that a policy snapshot hash was captured before execution.
 */
export function assertPolicyPresent(
  policyHash: string | null | undefined,
  runId: string,
): void {
  assertDefined(
    policyHash,
    'INV_POLICY_MISSING',
    `No policy snapshot hash recorded for run ${truncate(runId)}`,
  );
}

/**
 * Assert that the cost was calculated before commit.
 */
export function assertCostRecorded(
  costUnits: number | null | undefined,
  runId: string,
): void {
  assertInvariant(
    costUnits !== null && costUnits !== undefined && costUnits >= 0,
    'INV_COST_BEFORE_COMMIT',
    `Cost not recorded before commit for run ${truncate(runId)}`,
  );
}

/**
 * Assert that a state machine transition does not regress.
 */
export function assertNoStateRegression(
  currentIndex: number,
  previousIndex: number,
  stateName: string,
): void {
  assertInvariant(
    currentIndex >= previousIndex,
    'INV_STATE_REGRESSION',
    `State regression detected: cannot move backward to "${stateName}"`,
  );
}

/**
 * Assert that arbitration was performed before provider execution.
 */
export function assertArbitrationBeforeExecution(
  arbitrated: boolean,
  runId: string,
): void {
  assertInvariant(
    arbitrated,
    'INV_ARBITRATION_BEFORE_EXECUTE',
    `Arbitration decision not stored before provider call for run ${truncate(runId)}`,
  );
}

/**
 * Assert that policy was enforced before provider execution.
 */
export function assertPolicyBeforeExecution(
  policyEnforced: boolean,
  runId: string,
): void {
  assertInvariant(
    policyEnforced,
    'INV_POLICY_BEFORE_EXECUTE',
    `Policy not enforced before provider execution for run ${truncate(runId)}`,
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'auth', 'credential', 'api_key'];

function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    const isSensitive = SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk));
    sanitized[k] = isSensitive ? '[REDACTED]' : v;
  }
  return sanitized;
}

function truncate(s: string, maxLen = 40): string {
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen) + '...';
}
