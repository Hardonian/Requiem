import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ProblemPayload {
  type: string;
  title: string;
  status: number;
  detail: string;
  trace_id: string;
  code?: string;
  errors?: Array<Record<string, unknown>>;
}

export interface ProblemOptions {
  status: number;
  title: string;
  detail: string;
  traceId: string;
  requestId?: string;
  type?: string;
  code?: string;
  errors?: Array<Record<string, unknown>>;
  retryAfterSec?: number;
  headers?: HeadersInit;
}

export class ProblemError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly code?: string;
  public readonly errors?: Array<Record<string, unknown>>;

  constructor(
    status: number,
    title: string,
    detail: string,
    options: {
      code?: string;
      errors?: Array<Record<string, unknown>>;
      cause?: unknown;
    } = {},
  ) {
    super(detail);
    this.name = 'ProblemError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.code = options.code;
    this.errors = options.errors;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function traceIdFromHeaders(headers: Headers): string {
  const existing = headers.get('x-trace-id');
  if (existing && existing.trim()) {
    return existing;
  }

  const traceparent = headers.get('traceparent');
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
  }

  return randomUUID();
}

export function requestIdFromHeaders(headers: Headers): string {
  return headers.get('x-request-id') ?? randomUUID();
}

export function problemResponse(options: ProblemOptions): NextResponse {
  const payload: ProblemPayload = {
    type: options.type ?? `https://httpstatuses.com/${options.status}`,
    title: options.title,
    status: options.status,
    detail: options.detail,
    trace_id: options.traceId,
    ...(options.code ? { code: options.code } : {}),
    ...(options.errors ? { errors: options.errors } : {}),
  };

  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/problem+json');
  headers.set('x-trace-id', options.traceId);
  if (options.requestId) {
    headers.set('x-request-id', options.requestId);
  }
  if (options.retryAfterSec !== undefined) {
    headers.set('retry-after', String(Math.max(0, Math.floor(options.retryAfterSec))));
  }

  return new NextResponse(JSON.stringify(payload), {
    status: options.status,
    headers,
  });
}

export function unknownErrorToProblem(
  error: unknown,
  traceId: string,
  requestId?: string,
): NextResponse {
  if (error instanceof ProblemError) {
    return problemResponse({
      status: error.status,
      title: error.title,
      detail: error.detail,
      traceId,
      requestId,
      code: error.code,
      errors: error.errors,
    });
  }

  if (error instanceof ZodError) {
    return problemResponse({
      status: 400,
      title: 'Validation Failed',
      detail: 'Request validation failed',
      code: 'validation_error',
      traceId,
      requestId,
      errors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    });
  }

  return problemResponse({
    status: 500,
    title: 'Internal Server Error',
    detail: 'Request failed safely',
    code: 'internal_error',
    traceId,
    requestId,
  });
}
