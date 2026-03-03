export type AuditEventType =
  | 'RUN_CREATED'
  | 'RUN_FINALIZED'
  | 'POLICY_DENIED'
  | 'COST_LIMIT_TRIPPED'
  | 'REGISTRY_PUBLISHED'
  | 'DRIFT_DETECTED'
  | 'DRIFT_REGRESSED';

export interface AuditEvent {
  event_id: string;
  tenant_id: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
  event_type: AuditEventType;
  payload_hash: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditStore {
  append(event: AuditEvent): Promise<void>;
  list(cursor?: string, limit?: number): Promise<{ items: AuditEvent[]; nextCursor?: string }>;
}
