import type { ProofTriggerEvent } from './types.js';

const ALLOWED_REASONS = new Set<ProofTriggerEvent['trigger_reason']>([
  'manual',
  'policy_violation',
  'regression_detected',
  'adapter_ingest',
]);

export function validateTriggerCapabilities(trigger: ProofTriggerEvent, capabilities: string[]): boolean {
  const hasReviewCapability = capabilities.includes('review:run');
  return hasReviewCapability && ALLOWED_REASONS.has(trigger.trigger_reason) && trigger.context_artifacts.length > 0;
}
