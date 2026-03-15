import { describe, expect, it } from 'vitest';
import { classifyProtectedRouteTruth } from '@/lib/protected-route-truth';

describe('classifyProtectedRouteTruth', () => {
  it('marks undeclared protected routes as source-inspected', () => {
    const result = classifyProtectedRouteTruth('/intelligence/verification', true);
    expect(result.stateLabel).toBe('source-inspected route');
    expect(result.tone).toBe('warning');
  });

  it('marks runtime-backed routes as backend-missing when backend is unconfigured', () => {
    const result = classifyProtectedRouteTruth('/registry', false);
    expect(result.stateLabel).toBe('backend missing');
    expect(result.tone).toBe('warning');
  });

  it('returns route maturity classifications for known routes', () => {
    const result = classifyProtectedRouteTruth('/console/replication', true);
    expect(result.stateLabel).toBe('informational route');
    expect(result.title.toLowerCase()).toContain('replication');
  });
});
