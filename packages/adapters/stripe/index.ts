import { BaseAdapter, createEvent } from '../base.js';

export class StripeAdapter extends BaseAdapter {
  name = 'stripe';
  version = '1.0.0';

  normalize(input_payload: unknown) {
    const payload = this.redact(input_payload) as Record<string, unknown>;
    const artifact = this.pipeline.storeArtifact({ media_type: 'application/json', content: JSON.stringify(payload), redacted: true });
    const event = createEvent('stripe.webhook', String(payload.type ?? 'billing.unknown'), artifact.cas_ref, {
      amount: payload.amount,
      currency: payload.currency,
      economic_artifact: true,
      proof_pack_ref: `cas:${artifact.cas_ref}`,
    });
    return { event, artifacts: [artifact] };
  }

  redact(payload: unknown): unknown {
    const value = (payload && typeof payload === 'object') ? { ...(payload as Record<string, unknown>) } : {};
    if ('card_last4' in value) value.card_last4 = '[REDACTED]';
    return value;
  }
}
