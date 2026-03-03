import type { AuditEvent, AuditStore } from './types.js';

export async function queryAuditEvents(store: AuditStore, params: {
  tenant_id?: string;
  event_type?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: AuditEvent[]; nextCursor?: string }> {
  const page = await store.list(params.cursor, params.limit);
  const filtered = page.items.filter((e) => (!params.tenant_id || e.tenant_id === params.tenant_id)
    && (!params.event_type || e.event_type === params.event_type));
  return { items: filtered, nextCursor: page.nextCursor };
}
