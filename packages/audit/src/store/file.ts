import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AuditEvent, AuditStore } from '../types.js';

export class FileAuditStore implements AuditStore {
  constructor(private readonly filepath: string) {}

  async append(event: AuditEvent): Promise<void> {
    await mkdir(dirname(this.filepath), { recursive: true });
    await appendFile(this.filepath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  async list(cursor?: string, limit = 50): Promise<{ items: AuditEvent[]; nextCursor?: string }> {
    try {
      const raw = await readFile(this.filepath, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      const start = cursor ? Number.parseInt(cursor, 10) : 0;
      const items = lines.slice(start, start + limit).map((line) => JSON.parse(line) as AuditEvent);
      const next = start + limit < lines.length ? String(start + limit) : undefined;
      return { items, nextCursor: next };
    } catch {
      return { items: [] };
    }
  }
}
