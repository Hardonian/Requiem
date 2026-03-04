import { createHash, randomUUID } from 'node:crypto';

import type { Artifact, ArtifactInput } from '../../primitives/artifact.js';
import type { Event } from '../../primitives/event.js';
import type { Receipt } from '../../primitives/receipt.js';

export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  detail: string;
  trace_id: string;
}

export interface NormalizeResult {
  event: Event;
  artifacts: Artifact[];
}

export interface PrimitiveAdapter {
  name: string;
  version: string;
  normalize(input_payload: unknown): NormalizeResult;
  redact(payload: unknown): unknown;
  emit(event: Event): Receipt;
}

export class CasStore {
  private readonly data = new Map<string, string>();

  put(content: string): string {
    const digest = createHash('sha256').update(content).digest('hex');
    this.data.set(digest, content);
    return digest;
  }

  get(digest: string): string | undefined {
    return this.data.get(digest);
  }
}

export class KernelEventPipeline {
  constructor(private readonly cas: CasStore) {}

  storeArtifact(input: ArtifactInput): Artifact {
    const cas_ref = this.cas.put(input.content);
    return {
      cas_ref,
      media_type: input.media_type,
      size_bytes: Buffer.byteLength(input.content, 'utf8'),
      redacted: input.redacted ?? false,
      created_at: new Date().toISOString(),
    };
  }

  emitReceipt(event: Event, action: string, detail?: Record<string, unknown>): Receipt {
    return {
      id: randomUUID(),
      event_id: event.id,
      action,
      actor: 'kernel',
      status: 'accepted',
      trace_id: String(event.metadata.trace_id ?? randomUUID()),
      created_at: new Date().toISOString(),
      detail,
    };
  }
}

export function problemFromError(error: unknown, trace_id: string): ProblemJson {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    type: 'about:blank',
    title: 'Adapter processing failed',
    status: 400,
    detail,
    trace_id,
  };
}
