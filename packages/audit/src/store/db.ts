import type { AuditEvent, AuditStore } from '../types.js';

export class DbAuditStore implements AuditStore {
  constructor(private readonly adapter: { insert: (event: AuditEvent) => Promise<void>; query: (offset: number, limit: number) => Promise<AuditEvent[]> }) {}

  async append(event: AuditEvent): Promise<void> {
    await this.adapter.insert(event);
  }

  async list(cursor?: string, limit = 50): Promise<{ items: AuditEvent[]; nextCursor?: string }> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    const items = await this.adapter.query(offset, limit);
    return { items, nextCursor: items.length === limit ? String(offset + limit) : undefined };
  }
}
