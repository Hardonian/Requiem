import { BaseAdapter, createEvent } from '../base.js';

export class SentryAdapter extends BaseAdapter {
  name = 'sentry';
  version = '1.0.0';

  normalize(input_payload: unknown) {
    const payload = this.redact(input_payload) as Record<string, unknown>;
    const artifact = this.pipeline.storeArtifact({ media_type: 'application/json', content: JSON.stringify(payload), redacted: true });
    const event = createEvent('sentry.event', 'error.discrepancy', artifact.cas_ref, {
      issue: payload.issue,
      severity: payload.level,
      discrepancy_bundle: true,
      proof_pack_ref: `cas:${artifact.cas_ref}`,
    });
    return { event, artifacts: [artifact] };
  }

  redact(payload: unknown): unknown {
    const value = (payload && typeof payload === 'object') ? { ...(payload as Record<string, unknown>) } : {};
    if ('user_email' in value) value.user_email = '[REDACTED]';
    return value;
  }
}
