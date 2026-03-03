/**
 * Deterministic RNG wrapper for reproducible test data generation.
 * Uses a seeded PRNG to ensure the same seed always produces the same sequence.
 */

/**
 * Simple seeded PRNG using mulberry32 algorithm.
 * This is fast and deterministic - same seed always produces same sequence.
 */
export class SeededRNG {
  private state: number;

  /**
   * Create a seeded RNG with the given seed.
   */
  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number in [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate next random integer in [min, max).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Generate random boolean.
   */
  nextBoolean(): boolean {
    return this.next() > 0.5;
  }

  /**
   * Pick random element from array.
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }

  /**
   * Shuffle array in place (Fisher-Yates).
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate random string of given length from charset.
   */
  nextString(length: number, charset: string): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[this.nextInt(0, charset.length)];
    }
    return result;
  }

  /**
   * Generate random hex string of given length.
   */
  nextHex(length: number): string {
    return this.nextString(length, '0123456789abcdef');
  }

  /**
   * Generate random UUID v4 (deterministic).
   */
  nextUUID(): string {
    return (
      this.nextHex(8) +
      '-' +
      this.nextHex(4) +
      '-4' +
      this.nextHex(3) +
      '-' +
      this.nextHex(4) +
      '-' +
      this.nextHex(12)
    );
  }

  /**
   * Generate random email.
   */
  nextEmail(): string {
    const username = this.nextString(8, 'abcdefghijklmnopqrstuvwxyz');
    const domain = this.pick(['example.com', 'test.org', 'demo.net']);
    return `${username}@${domain}`;
  }

  /**
   * Generate random tenant ID from predefined list.
   */
  nextTenantId(): string {
    return this.pick([
      'public-hardonian',
      'acme-corp',
      'globex-inc',
      'initech',
      'umbrella-corp',
    ]);
  }

  /**
   * Generate random role from predefined list.
   */
  nextRole(): string {
    return this.pick(['admin', 'editor', 'viewer', 'guest']);
  }
}

/**
 * Create a seeded RNG from a seed value.
 */
export function createRNG(seed: number): SeededRNG {
  return new SeededRNG(seed);
}
