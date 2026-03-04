import { BaseAdapter, createEvent } from '../base.js';

export class GitHubAdapter extends BaseAdapter {
  name = 'github';
  version = '1.0.0';

  normalize(input_payload: unknown) {
    const payload = this.redact(input_payload) as Record<string, unknown>;
    const artifact = this.pipeline.storeArtifact({
      media_type: 'application/json',
      content: JSON.stringify(payload),
      redacted: true,
    });

    const event = createEvent('github.webhook', String(payload.action ?? 'unknown'), artifact.cas_ref, {
      repository: payload.repository,
      proof_pack_ref: `cas:${artifact.cas_ref}`,
      lineage_node: `github:${payload.repository ?? 'repo'}`,
    });
    return { event, artifacts: [artifact] };
  }

  redact(payload: unknown): unknown {
    const value = (payload && typeof payload === 'object') ? { ...(payload as Record<string, unknown>) } : {};
    if ('token' in value) value.token = '[REDACTED]';
    if ('authorization' in value) value.authorization = '[REDACTED]';
    return value;
  }
}
