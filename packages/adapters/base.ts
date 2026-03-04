import { randomUUID } from 'node:crypto';

import type { Event } from '../primitives/event.js';
import type { Receipt } from '../primitives/receipt.js';
import type { PrimitiveAdapter } from './sdk/index.js';
import { KernelEventPipeline } from './sdk/index.js';

export function createEvent(source: string, type: string, payload_cas: string, metadata: Record<string, unknown> = {}): Event {
  return {
    id: randomUUID(),
    type,
    source,
    payload_cas,
    metadata: {
      received_at: new Date().toISOString(),
      ...metadata,
    },
  };
}

export abstract class BaseAdapter implements PrimitiveAdapter {
  abstract name: string;
  abstract version: string;

  constructor(protected readonly pipeline: KernelEventPipeline) {}

  abstract normalize(input_payload: unknown): ReturnType<PrimitiveAdapter['normalize']>;
  abstract redact(payload: unknown): unknown;

  emit(event: Event): Receipt {
    return this.pipeline.emitReceipt(event, `adapter:${this.name}.emit`, {
      source: event.source,
      payload_cas: event.payload_cas,
    });
  }
}
