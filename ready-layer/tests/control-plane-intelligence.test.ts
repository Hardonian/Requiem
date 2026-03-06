import { describe, expect, it } from 'vitest';
import {
  computeReviewFixReadiness,
  diagnoseFailure,
  generateActionableInsights,
  type ConfigurationHierarchy,
} from '../src/lib/control-plane';

describe('control-plane readiness', () => {
  it('supports inherited org configuration for review and fixer readiness', () => {
    const config: ConfigurationHierarchy = {
      org: {
        provider_enabled: true,
        provider_name: 'openai',
        api_key_present: true,
        review_model: 'gpt-review',
        fixer_model: 'gpt-fixer',
        permissions: ['review:trigger', 'fixer:trigger', 'patch:apply'],
        repo_bound: true,
      },
      workspace: {
        allow_inheritance: true,
      },
      project: {
        allow_inheritance: true,
      },
    };

    const readiness = computeReviewFixReadiness(config);
    expect(readiness.status).toBe('Inherited');
    expect(readiness.review_ready).toBe(true);
    expect(readiness.fixer_ready).toBe(true);
    expect(readiness.inherited_from).toBe('org');
  });

  it('falls back to review-only when fixer model is missing', () => {
    const readiness = computeReviewFixReadiness({
      project: {
        provider_enabled: true,
        api_key_present: true,
        review_model: 'review-x',
        fixer_model: null,
        permissions: ['review:trigger'],
      },
    });

    expect(readiness.review_ready).toBe(true);
    expect(readiness.fixer_ready).toBe(false);
    expect(readiness.status).toBe('Partial');
  });
});

describe('failure diagnosis taxonomy', () => {
  it('maps API key failure to API_KEY_MISSING category', () => {
    const diagnosis = diagnoseFailure('Provider API key missing for request');
    expect(diagnosis.category).toBe('API_KEY_MISSING');
    expect(diagnosis.auto_remediation_eligible).toBe(false);
  });

  it('maps transient network errors to NETWORK_TRANSIENT category', () => {
    const diagnosis = diagnoseFailure('network timeout when invoking tool');
    expect(diagnosis.category).toBe('NETWORK_TRANSIENT');
    expect(diagnosis.auto_remediation_eligible).toBe(true);
  });
});

describe('insight generation', () => {
  it('returns insufficient-data insight when no failures are available', () => {
    const readiness = computeReviewFixReadiness({});
    const insights = generateActionableInsights([], readiness);
    expect(insights.some((insight) => insight.id === 'insight-insufficient-failure-data')).toBe(true);
  });

  it('returns actionable insight for repeated API key failures', () => {
    const readiness = computeReviewFixReadiness({
      project: {
        provider_enabled: false,
      },
    });

    const insights = generateActionableInsights(
      [
        { run_id: 'run-1', message: 'API key missing for provider', scope: 'run' },
        { run_id: 'run-2', message: 'API key missing for provider', scope: 'run' },
      ],
      readiness,
    );

    const keyGap = insights.find((insight) => insight.id === 'insight-api-key-gap');
    expect(keyGap?.manual_trigger_available).toBe(true);
    expect(keyGap?.auto_trigger_available).toBe(false);
  });
});
