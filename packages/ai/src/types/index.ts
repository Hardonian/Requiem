/**
 * @fileoverview Shared core types for the AI control-plane layer.
 *
 * These types are self-contained within @requiem/ai and do not
 * depend on any other @requiem/* package to avoid circular imports.
 *
 * INVARIANT: TenantContext is ALWAYS derived server-side.
 * INVARIANT: actorId is ALWAYS from a validated auth token.
 */

// ─── Tenant + Role ────────────────────────────────────────────────────────────

/**
 * Valid tenant membership roles, ordered by privilege level.
 */
export enum TenantRole {
  VIEWER = 'viewer',
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner',
}

const ROLE_HIERARCHY: Record<TenantRole, number> = {
  [TenantRole.VIEWER]: 0,
  [TenantRole.MEMBER]: 1,
  [TenantRole.ADMIN]: 2,
  [TenantRole.OWNER]: 3,
};

/** Check if actual role meets minimum required role. */
export function hasRequiredRole(actual: TenantRole, required: TenantRole): boolean {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

/**
 * Canonical tenant context.
 * Derived server-side and immutable once created.
 */
export interface TenantContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: TenantRole;
  readonly derivedAt: string;
}

// ─── Invocation Context ───────────────────────────────────────────────────────

/**
 * Full context passed to every tool/skill invocation.
 * Created once per request; never modified during execution.
 */
export interface InvocationContext {
  /** Validated tenant context (server-derived) */
  readonly tenant: TenantContext;
  /** Actor making the request */
  readonly actorId: string;
  /** Trace ID for distributed tracing */
  readonly traceId: string;
  /** Execution environment */
  readonly environment: 'development' | 'production' | 'test';
  /** ISO timestamp of context creation */
  readonly createdAt: string;
}

// ─── API Envelope ─────────────────────────────────────────────────────────────

/**
 * Standard JSON response envelope for all AI API endpoints.
 * Every endpoint MUST return this shape (ok:true or ok:false).
 */
export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: SerializedAiError;
  trace_id?: string;
  request_id?: string;
}

/**
 * Serialized error shape (safe to send to client).
 * NO stack traces. NO internal details. Redacted.
 */
export interface SerializedAiError {
  code: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
  retryable: boolean;
  phase?: string;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Generate a simple prefixed ID (crypto-random). */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

/** Current ISO timestamp. */
export function now(): string {
  return new Date().toISOString();
}
