import { createHash } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

import { canonicalStringify } from './canonical-json.js';

export function hashCanonical(value: unknown): string {
  return sha256(canonicalStringify(value));
}
