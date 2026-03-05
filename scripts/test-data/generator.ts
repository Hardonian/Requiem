import { writeFileSync } from 'fs';
import { createHash } from 'crypto';

export interface FoundryBundle {
  seed: number;
  scenario: string;
  generated_at: string;
  records: unknown[];
  digest: string;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function buildBundle(seed: number, scenario: string, records: unknown[]): FoundryBundle {
  const payload = JSON.stringify({ seed, scenario, records });
  const digest = createHash('sha256').update(payload).digest('hex');
  return {
    seed,
    scenario,
    generated_at: new Date(0).toISOString(),
    records,
    digest,
  };
}

export function exportBundle(path: string, bundle: FoundryBundle): void {
  writeFileSync(path, JSON.stringify(bundle, null, 2));
}
