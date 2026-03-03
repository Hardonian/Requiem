import { randomUUID } from 'node:crypto';
import { FileAuditStore } from '../../../audit/src/store/file.js';
import type { AuditEvent, AuditEventType } from '../../../audit/src/types.js';
import { canonicalStringify } from '../../../core/src/canonical-json.js';
import { hashCanonical, sha256 } from '../../../core/src/hash.js';
import type { RunEnvelope } from '../../../core/src/run-envelope.js';

const auditStore = new FileAuditStore('.requiem/audit/events.ndjson');

export async function appendAuditEvent(input: {
  tenant_id: string;
  actor_id: string;
  request_id?: string;
  trace_id?: string;
  event_type: AuditEventType;
  payload: Record<string, unknown>;
}): Promise<AuditEvent> {
  const payload = JSON.parse(canonicalStringify(input.payload)) as Record<string, unknown>;
  const event: AuditEvent = {
    event_id: randomUUID(),
    tenant_id: input.tenant_id,
    actor_id: input.actor_id,
    request_id: input.request_id ?? randomUUID(),
    trace_id: input.trace_id ?? randomUUID(),
    event_type: input.event_type,
    payload_hash: sha256(canonicalStringify(payload)),
    payload,
    created_at: new Date().toISOString(),
  };
  await auditStore.append(event);
  return event;
}

export function makeRunEnvelope(input: {
  run_id: string;
  tenant_id: string;
  project_id?: string;
  actor_id: string;
  engine_version: string;
  policy_version: string;
  promptset_version: string;
  provider_fingerprint: RunEnvelope['provider_fingerprint'];
  run_input: unknown;
  run_output: unknown;
  transcript: unknown;
  cost_units?: RunEnvelope['cost_units'];
  artifacts?: RunEnvelope['artifacts'];
  policy_decisions?: RunEnvelope['policy_decisions'];
  replay_pointers?: RunEnvelope['replay_pointers'];
}): RunEnvelope {
  return {
    run_id: input.run_id,
    tenant_id: input.tenant_id,
    project_id: input.project_id ?? 'default',
    actor_id: input.actor_id,
    created_at: new Date().toISOString(),
    engine_version: input.engine_version,
    policy_version: input.policy_version,
    promptset_version: input.promptset_version,
    provider_fingerprint: input.provider_fingerprint,
    input_hash: hashCanonical(input.run_input),
    output_hash: hashCanonical(input.run_output),
    transcript_hash: hashCanonical(input.transcript),
    cost_units: input.cost_units ?? { compute_units: 0, memory_units: 0, cas_io_units: 0 },
    artifacts: input.artifacts ?? [],
    policy_decisions: input.policy_decisions ?? [{ decision: 'allow', reasons: [], rule_ids: [] }],
    replay_pointers: input.replay_pointers ?? { cas_root: 'none', trace_stream: 'none' },
  };
}
