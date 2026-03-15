export type TruthState = 'live' | 'snapshot' | 'stub' | 'empty' | 'unconfigured' | 'error';

export interface TruthError {
  code: string;
  message: string;
}

export interface TruthEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: TruthError | null;
  traceId?: string;
  state: TruthState;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseError(value: unknown): TruthError | null {
  const candidate = asRecord(value);
  if (!candidate) return null;
  const code = typeof candidate.code === 'string' ? candidate.code : 'E_UNKNOWN';
  const message = typeof candidate.message === 'string' ? candidate.message : 'Request failed';
  return { code, message };
}

export function normalizeEnvelope<T>(payload: unknown): TruthEnvelope<T> {
  const root = asRecord(payload);
  if (!root) {
    return {
      ok: false,
      data: null,
      error: { code: 'E_INVALID_RESPONSE', message: 'Response payload was not an object' },
      state: 'error',
    };
  }

  const traceId = typeof root.trace_id === 'string' ? root.trace_id : undefined;
  const topLevelOk = typeof root.ok === 'boolean' ? root.ok : null;
  const topLevelData = root.data;
  const topLevelError = parseError(root.error);

  const nested = asRecord(topLevelData);
  const nestedOk = nested && typeof nested.ok === 'boolean' ? nested.ok : null;
  const nestedData = nested ? nested.data : undefined;
  const nestedError = nested ? parseError(nested.error) : null;

  const ok = topLevelOk ?? nestedOk ?? !topLevelError;
  const data = (nestedOk !== null ? nestedData : topLevelData) as T | null | undefined;
  const error = topLevelError ?? nestedError;

  if (!ok || error) {
    return {
      ok: false,
      data: null,
      error: error ?? { code: 'E_REQUEST_FAILED', message: 'Request failed' },
      traceId,
      state: 'error',
    };
  }

  if (data == null) {
    return { ok: true, data: null, error: null, traceId, state: 'empty' };
  }

  return { ok: true, data: data as T, error: null, traceId, state: inferTruthState(data) };
}

export function inferTruthState(data: unknown): TruthState {
  if (Array.isArray(data)) {
    return data.length === 0 ? 'empty' : 'live';
  }

  const record = asRecord(data);
  if (!record) return 'live';

  const source = typeof record.source === 'string' ? record.source.toLowerCase() : '';
  if (source.includes('stub') || source.includes('demo')) return 'stub';
  if (source.includes('snapshot') || source.includes('replay')) return 'snapshot';

  const mode = typeof record.mode === 'string' ? record.mode.toLowerCase() : '';
  if (mode.includes('stub') || mode.includes('demo')) return 'stub';

  const configured = record.configured;
  if (typeof configured === 'boolean' && !configured) return 'unconfigured';

  if (Object.keys(record).length === 0) return 'empty';
  return 'live';
}

export function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
