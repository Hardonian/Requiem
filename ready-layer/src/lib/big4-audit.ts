import { randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

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

function canonicalize(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(normalize);
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, normalize(value)]),
    );
  };
  return JSON.stringify(normalize(value));
}

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function writeAudit(event: Omit<AuditEvent, 'event_id' | 'created_at' | 'payload_hash'>): Promise<void> {
  const payload_hash = await sha256(canonicalize(event.payload));
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
