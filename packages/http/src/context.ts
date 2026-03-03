import { randomUUID } from 'node:crypto';

export interface RequestContext {
  tenant_id: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
}

export function extractContext(headers: Headers): RequestContext {
  return {
    tenant_id: headers.get('x-tenant-id') ?? 'public',
    actor_id: headers.get('x-actor-id') ?? 'anonymous',
    request_id: headers.get('x-request-id') ?? randomUUID(),
    trace_id: headers.get('x-trace-id') ?? randomUUID(),
  };
}
