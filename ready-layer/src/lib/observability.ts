import { AsyncLocalStorage } from 'node:async_hooks';

export interface ObservabilityContext {
  route_id: string;
  tenant_id: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
  method: string;
  pathname: string;
  idempotency_key?: string | null;
}

type LogLevel = 'info' | 'warn' | 'error';

const requestContextStorage = new AsyncLocalStorage<ObservabilityContext>();

export function withObservabilityContext<T>(
  context: ObservabilityContext,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function getObservabilityContext(): ObservabilityContext | undefined {
  return requestContextStorage.getStore();
}

function serializeError(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(typeof (error as { cause?: unknown }).cause !== 'undefined'
        ? { cause: serializeError((error as { cause?: unknown }).cause) ?? (error as { cause?: unknown }).cause }
        : {}),
    };
  }

  if (typeof error === 'object') {
    return { value: error as Record<string, unknown> };
  }

  return { value: String(error) };
}

export function logStructured(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  error?: unknown,
): void {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
    ...(error ? { error: serializeError(error) } : {}),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}
