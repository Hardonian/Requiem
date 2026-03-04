import { BaseAdapter, createEvent } from '../base.js';

export class OtelAdapter extends BaseAdapter {
  name = 'otel';
  version = '1.0.0';

  normalize(input_payload: unknown) {
    const payload = this.redact(input_payload) as Record<string, unknown>;
    const artifact = this.pipeline.storeArtifact({ media_type: 'application/json', content: JSON.stringify(payload), redacted: true });
    const event = createEvent('otel.span', 'timeline.span', artifact.cas_ref, {
      trace_id: payload.trace_id,
      span_id: payload.span_id,
      proof_pack_ref: `cas:${artifact.cas_ref}`,
    });
    return { event, artifacts: [artifact] };
  }

  redact(payload: unknown): unknown {
    return payload;
  }
}
