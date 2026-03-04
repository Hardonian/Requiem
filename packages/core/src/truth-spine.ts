import { createHash } from 'node:crypto';
import { canonicalStringify } from './canonical-json.js';

export interface ProblemJSON {
  type: string;
  title: string;
  status: number;
  detail: string;
  trace_id: string;
  code?: string;
  errors?: Array<Record<string, unknown>>;
  reasons?: string[];
}

export interface ProblemJSONOptions {
  status: number;
  title: string;
  detail: string;
  traceId: string;
  type?: string;
  code?: string;
  errors?: Array<Record<string, unknown>>;
  reasons?: string[];
}

export function canonicalize(value: unknown): string {
  return canonicalStringify(value);
}

export function stableSort<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const diff = compare(a.item, b.item);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.item);
}

export function hashBytes(bytes: string | Uint8Array, algorithm: 'sha256' = 'sha256'): string {
  const hash = createHash(algorithm);
  hash.update(bytes);
  return hash.digest('hex');
}

export function hashObject(value: unknown, algorithm: 'sha256' = 'sha256'): string {
  return hashBytes(canonicalize(value), algorithm);
}

export function buildProblemJSON(options: ProblemJSONOptions): ProblemJSON {
  return {
    type: options.type ?? `https://httpstatuses.com/${options.status}`,
    title: options.title,
    status: options.status,
    detail: options.detail,
    trace_id: options.traceId,
    ...(options.code ? { code: options.code } : {}),
    ...(options.errors ? { errors: options.errors } : {}),
    ...(options.reasons ? { reasons: options.reasons } : {}),
  };
}
