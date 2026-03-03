import { z } from 'zod';

export const runEnvelopeSchema = z.object({
  run_id: z.string().min(1),
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  actor_id: z.string().min(1),
  created_at: z.string().datetime(),
  engine_version: z.string().min(1),
  policy_version: z.string().min(1),
  promptset_version: z.string().min(1),
  provider_fingerprint: z.object({
    model: z.string(),
    vendor: z.string(),
    params: z.record(z.union([z.string(), z.number(), z.boolean()])),
  }),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
  output_hash: z.string().regex(/^[a-f0-9]{64}$/),
  transcript_hash: z.string().regex(/^[a-f0-9]{64}$/),
  cost_units: z.object({
    compute_units: z.number().nonnegative(),
    memory_units: z.number().nonnegative(),
    cas_io_units: z.number().nonnegative(),
    network_units: z.number().nonnegative().optional(),
  }),
  artifacts: z.array(z.object({
    cas_address: z.string().min(1),
    filename: z.string().min(1),
    mime: z.string().min(1),
    size: z.number().int().nonnegative(),
  })),
  policy_decisions: z.array(z.object({
    decision: z.enum(['allow', 'deny']),
    reasons: z.array(z.string()),
    rule_ids: z.array(z.string()),
  })),
  replay_pointers: z.object({
    cas_root: z.string().min(1),
    trace_stream: z.string().min(1),
  }),
});
