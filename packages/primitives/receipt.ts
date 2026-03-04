export interface Receipt {
  id: string;
  event_id: string;
  action: string;
  actor: string;
  status: 'accepted' | 'rejected';
  trace_id: string;
  created_at: string;
  detail?: Record<string, unknown>;
}

export function isReceipt(value: unknown): value is Receipt {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as Receipt).id === 'string'
    && typeof (value as Receipt).event_id === 'string'
    && typeof (value as Receipt).status === 'string';
}
