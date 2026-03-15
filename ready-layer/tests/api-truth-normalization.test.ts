import { describe, expect, it } from 'vitest';
import { normalizeEnvelope } from '../src/lib/api-truth';

describe('normalizeEnvelope', () => {
  it('parses top-level envelope arrays', () => {
    const normalized = normalizeEnvelope<{ id: string }[]>({ ok: true, data: [{ id: 'a' }] });
    expect(normalized.ok).toBe(true);
    expect(normalized.data?.[0]?.id).toBe('a');
    expect(normalized.state).toBe('live');
  });

  it('parses nested envelope shape data.ok + data.data', () => {
    const normalized = normalizeEnvelope<{ id: string }[]>({
      v: 1,
      kind: 'logs.list',
      data: { ok: true, data: [{ id: 'nested' }] },
      error: null,
    });

    expect(normalized.ok).toBe(true);
    expect(normalized.data?.[0]?.id).toBe('nested');
  });

  it('returns error state when nested envelope reports failure', () => {
    const normalized = normalizeEnvelope({
      data: { ok: false, error: { code: 'E_DOWN', message: 'down' } },
      error: null,
    });

    expect(normalized.ok).toBe(false);
    expect(normalized.state).toBe('error');
    expect(normalized.error?.code).toBe('E_DOWN');
  });
});
