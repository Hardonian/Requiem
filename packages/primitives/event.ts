export interface EventMetadata {
  tenant_id?: string;
  trace_id?: string;
  received_at: string;
  [key: string]: unknown;
}

export interface Event {
  id: string;
  type: string;
  source: string;
  payload_cas: string;
  metadata: EventMetadata;
}

export function assertEvent(value: unknown): Event {
  if (!value || typeof value !== 'object') {
    throw new Error('Event must be an object');
  }

  const event = value as Partial<Event>;
  if (!event.id || !event.type || !event.source || !event.payload_cas || !event.metadata) {
    throw new Error('Event missing required fields');
  }

  return event as Event;
}
