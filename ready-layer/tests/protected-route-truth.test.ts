import { describe, expect, it } from 'vitest';
import { classifyProtectedRouteTruth } from '@/lib/protected-route-truth';

describe('classifyProtectedRouteTruth', () => {
  it('keeps unknown protected routes as source-inspected fallback', () => {
    const result = classifyProtectedRouteTruth('/unknown/protected-route', true);
    expect(result.stateLabel).toBe('source-inspected route');
    expect(result.tone).toBe('warning');
  });

  it('marks runtime-backed routes as backend-missing when backend is unconfigured', () => {
    const result = classifyProtectedRouteTruth('/registry', false);
    expect(result.stateLabel).toBe('backend missing');
    expect(result.tone).toBe('warning');
  });

  it('classifies major authenticated route families without fallback', () => {
    const routes = [
      '/console/overview',
      '/console/objects',
      '/app/executions',
      '/app/replay',
      '/intelligence/verification',
      '/intelligence/foundry',
      '/settings',
    ];

    for (const route of routes) {
      const result = classifyProtectedRouteTruth(route, true);
      expect(result.stateLabel, `unexpected fallback for ${route}`).not.toBe('source-inspected route');
    }
  });

  it('returns route maturity classifications for known routes', () => {
    const result = classifyProtectedRouteTruth('/console/replication', true);
    expect(result.stateLabel).toBe('informational route');
    expect(result.title.toLowerCase()).toContain('replication');
  });
});
