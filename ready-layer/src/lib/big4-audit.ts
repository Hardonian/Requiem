import { randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { hashObject } from '../../../packages/core/src/truth-spine.js';

export interface AuditEvent {
  event_id: string;
  tenant_id: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
  event_type: string;
  payload_hash: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function writeAudit(event: Omit<AuditEvent, 'event_id' | 'created_at' | 'payload_hash'>): Promise<void> {
  const payload_hash = hashObject(event.payload);
  const full: AuditEvent = {
    ...event,
    event_id: randomUUID(),
    payload_hash,
    created_at: new Date().toISOString(),
  };

  const filepath = '.requiem/audit/events.ndjson';
  await mkdir(dirname(filepath), { recursive: true });
  await appendFile(filepath, `${JSON.stringify(full)}\n`, 'utf8');
}
