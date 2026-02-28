/**
 * Tenant Resolution — Single Source of Truth
 * 
 * INVARIANT: Tenant derivation is ALWAYS server-side.
 * INVARIANT: Client input is NEVER trusted for tenant identification.
 * INVARIANT: All tenant-scoped operations validate membership.
 * 
 * This module provides the canonical tenant resolution logic for:
 * - API routes (HTTP requests)
 * - CLI commands (session context)
 * - Background jobs (worker context)
 */

import { RequiemError, ErrorCode, ErrorSeverity, type ErrorMeta } from './errors';

/**
 * Valid tenant membership roles.
 * Ordered by privilege level (higher = more access).
 */
export enum TenantRole {
  VIEWER = 'viewer',       // Read-only access
  MEMBER = 'member',       // Standard access
  ADMIN = 'admin',         // Administrative access
  OWNER = 'owner',         // Full control
}

const ROLE_HIERARCHY: Record<TenantRole, number> = {
  [TenantRole.VIEWER]: 0,
  [TenantRole.MEMBER]: 1,
  [TenantRole.ADMIN]: 2,
  [TenantRole.OWNER]: 3,
};

/**
 * Canonical tenant context.
 * Derived server-side and immutable once created.
 */
export interface TenantContext {
  /** Tenant identifier (UUID format) */
  readonly tenantId: string;
  /** User identifier within the tenant */
  readonly userId: string;
  /** User's membership role */
  readonly role: TenantRole;
  /** When context was derived (for debugging) */
  readonly derivedAt: string;
  /** Derivation method for audit trail */
  readonly derivedFrom: 'jwt' | 'session' | 'api_key' | 'service_account';
}

/**
 * Options for tenant resolution.
 */
export interface TenantResolutionOptions {
  /** Required minimum role (defaults to VIEWER) */
  minRole?: TenantRole;
  /** Whether to allow service accounts (defaults to true) */
  allowServiceAccount?: boolean;
  /** Additional metadata for error context */
  meta?: ErrorMeta;
}

/**
 * Tenant membership record (from database).
 */
export interface TenantMembership {
  tenantId: string;
  userId: string;
  role: TenantRole;
  active: boolean;
  expiresAt?: Date;
}

/**
 * Result of tenant resolution.
 */
export type TenantResolutionResult =
  | { success: true; context: TenantContext }
  | { success: false; error: RequiemError };

/**
 * Interface for tenant resolution dependencies.
 * Allows injection of different implementations (DB, mock, cache).
 */
export interface TenantResolver {
  /**
   * Resolve tenant from HTTP request context.
   * Extracts auth token, validates, and returns tenant context.
   */
  resolveFromRequest(
    request: RequestLike,
    options?: TenantResolutionOptions
  ): Promise<TenantResolutionResult>;

  /**
   * Resolve tenant from CLI session.
   * Uses stored credentials or environment.
   */
  resolveFromCli(
    env?: Record<string, string | undefined>,
    options?: TenantResolutionOptions
  ): Promise<TenantResolutionResult>;

  /**
   * Validate that a user has required role in tenant.
   */
  validateMembership(
    tenantId: string,
    userId: string,
    minRole: TenantRole
  ): Promise<boolean>;

  /**
   * Get active memberships for a user.
   */
  getMemberships(userId: string): Promise<TenantMembership[]>;
}

/**
 * Minimal request interface for abstraction.
 */
export interface RequestLike {
  headers: {
    get(name: string): string | null;
  };
  url: string;
}

/**
 * Production tenant resolver using Supabase/Prisma.
 */
export class DefaultTenantResolver implements TenantResolver {
  private db: TenantDB;

  constructor(db: TenantDB) {
    this.db = db;
  }

  async resolveFromRequest(
    request: RequestLike,
    options: TenantResolutionOptions = {}
  ): Promise<TenantResolutionResult> {
    const { minRole = TenantRole.VIEWER, meta } = options;

    try {
      // Extract auth token from header
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Authorization header required',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta,
          }),
        };
      }

      // Parse token (Bearer or API key format)
      const token = this.extractToken(authHeader);
      if (!token) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid authorization format',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta,
          }),
        };
      }

      // Validate token and get claims
      const claims = await this.validateToken(token);
      if (!claims) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid or expired token',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta,
          }),
        };
      }

      // Extract tenant from claims (never from request body/params)
      const tenantId = claims.tenant_id;
      const userId = claims.sub;

      if (!tenantId || !userId) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Token missing required claims',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta,
          }),
        };
      }

      // Verify membership and role
      const membership = await this.db.getMembership(tenantId, userId);
      if (!membership || !membership.active) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.MEMBERSHIP_REQUIRED,
            message: 'Active tenant membership required',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta: { ...meta, tenantId, userId },
          }),
        };
      }

      // Check role hierarchy
      if (!hasRequiredRole(membership.role, minRole)) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.FORBIDDEN,
            message: `Insufficient permissions (required: ${minRole})`,
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta: { ...meta, tenantId, userId, context: { actualRole: membership.role, requiredRole: minRole } },
          }),
        };
      }

      // Check expiration if applicable
      if (membership.expiresAt && membership.expiresAt < new Date()) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.MEMBERSHIP_REQUIRED,
            message: 'Tenant membership has expired',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta: { ...meta, tenantId, userId },
          }),
        };
      }

      const context: TenantContext = {
        tenantId,
        userId,
        role: membership.role,
        derivedAt: new Date().toISOString(),
        derivedFrom: claims.type === 'service_account' ? 'service_account' : 'jwt',
      };

      return { success: true, context };
    } catch (error) {
      return {
        success: false,
        error: RequiemError.fromUnknown(error, 'Tenant resolution failed'),
      };
    }
  }

  async resolveFromCli(
    env: Record<string, string | undefined> = process.env,
    options: TenantResolutionOptions = {}
  ): Promise<TenantResolutionResult> {
    const { minRole = TenantRole.VIEWER, meta } = options;

    // Priority: REQUIEM_TENANT_ID + API key > Config file
    const tenantId = env.REQUIEM_TENANT_ID;
    const apiKey = env.REQUIEM_API_KEY;

    if (!tenantId) {
      return {
        success: false,
        error: new RequiemError({
          code: ErrorCode.TENANT_NOT_FOUND,
          message: 'REQUIEM_TENANT_ID environment variable required',
          severity: ErrorSeverity.WARNING,
          retryable: false,
          meta,
        }),
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: new RequiemError({
          code: ErrorCode.UNAUTHORIZED,
          message: 'REQUIEM_API_KEY environment variable required',
          severity: ErrorSeverity.WARNING,
          retryable: false,
          meta,
        }),
      };
    }

    // Validate API key and get user info
    try {
      const keyData = await this.db.validateApiKey(apiKey);
      if (!keyData || keyData.tenantId !== tenantId) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid API key for specified tenant',
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta: { ...meta, tenantId },
          }),
        };
      }

      if (!hasRequiredRole(keyData.role, minRole)) {
        return {
          success: false,
          error: new RequiemError({
            code: ErrorCode.FORBIDDEN,
            message: `API key has insufficient permissions (required: ${minRole})`,
            severity: ErrorSeverity.WARNING,
            retryable: false,
            meta: { ...meta, tenantId, context: { actualRole: keyData.role } },
          }),
        };
      }

      const context: TenantContext = {
        tenantId,
        userId: keyData.userId,
        role: keyData.role,
        derivedAt: new Date().toISOString(),
        derivedFrom: 'api_key',
      };

      return { success: true, context };
    } catch (error) {
      return {
        success: false,
        error: RequiemError.fromUnknown(error, 'CLI tenant resolution failed'),
      };
    }
  }

  async validateMembership(
    tenantId: string,
    userId: string,
    minRole: TenantRole
  ): Promise<boolean> {
    const membership = await this.db.getMembership(tenantId, userId);
    if (!membership || !membership.active) return false;
    if (membership.expiresAt && membership.expiresAt < new Date()) return false;
    return hasRequiredRole(membership.role, minRole);
  }

  async getMemberships(userId: string): Promise<TenantMembership[]> {
    return this.db.getUserMemberships(userId);
  }

  private extractToken(authHeader: string): string | null {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
    // Also accept raw token (API key style)
    if (parts.length === 1) {
      return parts[0];
    }
    return null;
  }

  private async validateToken(token: string): Promise<TokenClaims | null> {
    // Delegate to database layer (which uses Supabase/Prisma)
    return this.db.validateJwt(token);
  }
}

/**
 * Database interface for tenant operations.
 * Implemented by actual DB layer.
 */
export interface TenantDB {
  getMembership(tenantId: string, userId: string): Promise<TenantMembership | null>;
  getUserMemberships(userId: string): Promise<TenantMembership[]>;
  validateApiKey(apiKey: string): Promise<{ tenantId: string; userId: string; role: TenantRole } | null>;
  validateJwt(token: string): Promise<TokenClaims | null>;
}

interface TokenClaims {
  sub: string;           // User ID
  tenant_id: string;     // Tenant ID
  type?: string;         // Token type
  exp?: number;          // Expiration
}

/**
 * Check if actual role meets minimum required role.
 */
export function hasRequiredRole(actual: TenantRole, required: TenantRole): boolean {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

/**
 * Convenience function for API routes.
 * Throws RequiemError on failure (for use with try/catch in handlers).
 */
export async function requireTenantContext(
  resolver: TenantResolver,
  request: RequestLike,
  options?: TenantResolutionOptions
): Promise<TenantContext> {
  const result = await resolver.resolveFromRequest(request, options);
  if (!result.success) {
    throw result.error;
  }
  return result.context;
}

/**
 * Convenience function for CLI commands.
 */
export async function requireTenantContextCli(
  resolver: TenantResolver,
  env?: Record<string, string | undefined>,
  options?: TenantResolutionOptions
): Promise<TenantContext> {
  const result = await resolver.resolveFromCli(env, options);
  if (!result.success) {
    throw result.error;
  }
  return result.context;
}

/**
 * Mock resolver for testing.
 */
export class MockTenantResolver implements TenantResolver {
  private memberships: Map<string, TenantMembership> = new Map();
  private apiKeys: Map<string, { tenantId: string; userId: string; role: TenantRole }> = new Map();

  setMembership(tenantId: string, userId: string, membership: TenantMembership): void {
    this.memberships.set(`${tenantId}:${userId}`, membership);
  }

  setApiKey(apiKey: string, data: { tenantId: string; userId: string; role: TenantRole }): void {
    this.apiKeys.set(apiKey, data);
  }

  async resolveFromRequest(
    request: RequestLike,
    _options?: TenantResolutionOptions
  ): Promise<TenantResolutionResult> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        success: false,
        error: new RequiemError({
          code: ErrorCode.UNAUTHORIZED,
          message: 'No authorization header',
          severity: ErrorSeverity.WARNING,
          retryable: false,
        }),
      };
    }

    // Mock: extract userId from header for testing
    const userId = authHeader.replace('Bearer ', '');
    const tenantId = 'test-tenant';
    const membership = this.memberships.get(`${tenantId}:${userId}`);

    if (!membership?.active) {
      return {
        success: false,
        error: new RequiemError({
          code: ErrorCode.MEMBERSHIP_REQUIRED,
          message: 'Membership not found',
          severity: ErrorSeverity.WARNING,
          retryable: false,
        }),
      };
    }

    return {
      success: true,
      context: {
        tenantId,
        userId,
        role: membership.role,
        derivedAt: new Date().toISOString(),
        derivedFrom: 'jwt',
      },
    };
  }

  async resolveFromCli(
    env?: Record<string, string | undefined>,
    _options?: TenantResolutionOptions
  ): Promise<TenantResolutionResult> {
    const apiKey = env?.REQUIEM_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: new RequiemError({
          code: ErrorCode.UNAUTHORIZED,
          message: 'No API key',
          severity: ErrorSeverity.WARNING,
          retryable: false,
        }),
      };
    }

    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return {
        success: false,
        error: new RequiemError({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Invalid API key',
          severity: ErrorSeverity.WARNING,
          retryable: false,
        }),
      };
    }

    return {
      success: true,
      context: {
        tenantId: keyData.tenantId,
        userId: keyData.userId,
        role: keyData.role,
        derivedAt: new Date().toISOString(),
        derivedFrom: 'api_key',
      },
    };
  }

  async validateMembership(tenantId: string, userId: string, minRole: TenantRole): Promise<boolean> {
    const membership = this.memberships.get(`${tenantId}:${userId}`);
    return membership?.active === true && hasRequiredRole(membership.role, minRole);
  }

  async getMemberships(userId: string): Promise<TenantMembership[]> {
    return Array.from(this.memberships.values()).filter(m => m.userId === userId);
  }
}

/**
 * Global tenant resolver instance.
 * Set at application startup.
 */
let globalResolver: TenantResolver | null = null;

export function setGlobalTenantResolver(resolver: TenantResolver): void {
  globalResolver = resolver;
}

export function getGlobalTenantResolver(): TenantResolver {
  if (!globalResolver) {
    throw new RequiemError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Tenant resolver not initialized',
      severity: ErrorSeverity.CRITICAL,
      retryable: false,
    });
  }
  return globalResolver;
}
