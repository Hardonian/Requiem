import { describe, expect, it } from 'vitest';

describe('marketplace prompt package manifest', () => {
  it('contains an example inputs file reference', () => {
    expect('example_inputs.json').toContain('example_inputs');
  });
});
