import type { AuditEvent, AuditStore } from '../types.js';

export class MemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(Object.freeze({ ...event }));
  }

  async list(cursor?: string, limit = 50): Promise<{ items: AuditEvent[]; nextCursor?: string }> {
    const start = cursor ? Number.parseInt(cursor, 10) : 0;
    const items = this.events.slice(start, start + limit);
    const next = start + limit < this.events.length ? String(start + limit) : undefined;
    return { items, nextCursor: next };
  }
}
