import { BaseAdapter, createEvent } from '../base.js';

export class ToolcallAdapter extends BaseAdapter {
  name = 'toolcall';
  version = '1.0.0';

  normalize(input_payload: unknown) {
    const payload = this.redact(input_payload) as Record<string, unknown>;
    const artifact = this.pipeline.storeArtifact({ media_type: 'application/json', content: JSON.stringify(payload), redacted: true });
    const event = createEvent('toolcall.jsonrpc', 'tool.call', artifact.cas_ref, {
      method: payload.method,
      id: payload.id,
      proof_pack_ref: `cas:${artifact.cas_ref}`,
    });
    return { event, artifacts: [artifact] };
  }

  redact(payload: unknown): unknown {
    const value = (payload && typeof payload === 'object') ? { ...(payload as Record<string, unknown>) } : {};
    if ('params' in value && typeof value.params === 'object' && value.params) {
      value.params = '[REDACTED_PARAMS]';
    }
    return value;
  }
}
