// ready-layer/src/lib/engine-client.ts
//
// BOUNDARY CONTRACT: Node API ↔ Next.js
//
// INVARIANT: This file is the ONLY place in the Next.js layer that communicates
// with the engine. All Next.js route handlers must go through this client.
// Direct engine calls from route files are FORBIDDEN (enforces Phase B invariant:
// "No route directly calls engine. All engine calls go through Node API boundary.").
//
// EXTENSION_POINT: node_api_bridge
//   Current: HTTP client calling a local Node API server (REQUIEM_API_URL).
//   Upgrade path: replace with gRPC client for lower latency and typed schemas.
//   Invariant: this module must validate all responses before returning to callers.
//   Invariant: this module must never expose raw engine errors to the Next.js layer;
//   always wrap in a typed ApiError with structured error_code.

import type {
  HealthResponse,
  EngineStatusResponse,
  EngineStats,
  CASIntegrityReport,
  ReplayVerifyResponse,
  ExecutionRecord,
  AuditLogEntry,
  ClusterStatusResponse,
  ClusterWorkersResponse,
} from '@/types/engine';

// The Node API base URL. Configured via environment variable.
// In production: set REQUIEM_API_URL to the internal Node API service URL.
// In development: defaults to localhost:3001.
const API_BASE = process.env.REQUIEM_API_URL ?? 'http://localhost:3001';

// Tenant ID from JWT/session (passed in from route handlers that have auth context).
// INVARIANT: All API calls that touch tenant data MUST supply tenant_id.
// Routes without tenant context (health, public metrics) pass empty string.
export type TenantContext = { tenant_id: string; auth_token: string };

class ApiError extends Error {
  constructor(
    public readonly error_code: string,
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
  tenant?: TenantContext,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requiem-Version': '1',
    ...(opts.headers as Record<string, string> | undefined),
  };

  if (tenant?.auth_token) {
    headers['Authorization'] = `Bearer ${tenant.auth_token}`;
  }
  if (tenant?.tenant_id) {
    headers['X-Tenant-ID'] = tenant.tenant_id;
  }

  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (err) {
    throw new ApiError('network_error', `Failed to reach Node API at ${url}: ${err}`);
  }

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    throw new ApiError(
      `http_${res.status}`,
      `Node API returned ${res.status} for ${path}: ${body}`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public client methods
// ---------------------------------------------------------------------------

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export async function fetchEngineStatus(tenant: TenantContext): Promise<EngineStatusResponse> {
  return apiFetch<EngineStatusResponse>('/api/engine/status', {}, tenant);
}

export async function fetchEngineMetrics(tenant: TenantContext): Promise<EngineStats> {
  return apiFetch<EngineStats>('/api/engine/metrics', {}, tenant);
}

export async function fetchEngineDiagnostics(tenant: TenantContext): Promise<unknown> {
  return apiFetch<unknown>('/api/engine/diagnostics', {}, tenant);
}

export async function fetchCASIntegrity(tenant: TenantContext): Promise<CASIntegrityReport> {
  return apiFetch<CASIntegrityReport>('/api/cas/integrity', {}, tenant);
}

export async function verifyReplay(
  tenant: TenantContext,
  execution_id: string,
): Promise<ReplayVerifyResponse> {
  return apiFetch<ReplayVerifyResponse>(
    `/api/replay/verify?execution_id=${encodeURIComponent(execution_id)}`,
    {},
    tenant,
  );
}

export async function fetchExecutions(
  tenant: TenantContext,
  limit = 10,
): Promise<ExecutionRecord[]> {
  return apiFetch<ExecutionRecord[]>(
    `/api/executions?limit=${limit}`,
    {},
    tenant,
  );
}

export async function fetchAuditLogs(
  tenant: TenantContext,
  limit = 50,
): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>(
    `/api/audit/logs?limit=${limit}`,
    {},
    tenant,
  );
}

// ---------------------------------------------------------------------------
// Cluster platform client methods
// ---------------------------------------------------------------------------

export async function fetchClusterStatus(tenant: TenantContext): Promise<ClusterStatusResponse> {
  return apiFetch<ClusterStatusResponse>('/api/cluster/status', {}, tenant);
}

export async function fetchClusterWorkers(tenant: TenantContext): Promise<ClusterWorkersResponse> {
  return apiFetch<ClusterWorkersResponse>('/api/cluster/workers', {}, tenant);
}

// EXTENSION_POINT: governance_enhancements
// Add: fetchDeterminismReport(), triggerDistributedReplay(), exportAuditLogs()
