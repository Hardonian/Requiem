export interface DeterministicRng {
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(values: readonly T[]): T;
  hex(length: number): string;
  string(length: number, alphabet: string): string;
}

class Mulberry32Rng implements DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) {
      throw new Error('Invalid range for RNG.int');
    }
    return Math.floor(this.next() * (maxExclusive - minInclusive)) + minInclusive;
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return values[this.int(0, values.length)];
  }

  string(length: number, alphabet: string): string {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[this.int(0, alphabet.length)];
    }
    return out;
  }

  hex(length: number): string {
    return this.string(length, '0123456789abcdef');
  }
}

export function createRng(seed: number): DeterministicRng {
  return new Mulberry32Rng(seed);
}
