import { describe, expect, it } from 'vitest';
import { classifyApiFailure } from '@/lib/route-truth';

describe('classifyApiFailure', () => {
  it('classifies missing backend configuration', () => {
    const result = classifyApiFailure({ status: 503, code: 'backend_unconfigured', message: 'REQUIEM_API_URL missing' });
    expect(result.kind).toBe('backend-missing');
  });

  it('classifies forbidden responses', () => {
    const result = classifyApiFailure({ status: 403, code: 'forbidden', message: 'denied' });
    expect(result.kind).toBe('forbidden');
  });

  it('classifies engine failures', () => {
    const result = classifyApiFailure({ status: 502, code: 'engine_status_unavailable', message: 'engine failed' });
    expect(result.kind).toBe('engine-unavailable');
  });

  it('classifies no data responses', () => {
    const result = classifyApiFailure({ status: 404, code: 'run_not_found', message: 'not found' });
    expect(result.kind).toBe('no-data');
  });
});
