import { describe, expect, it } from 'vitest';

import { isNodeVersionSupported } from '../../src/commands/quickstart.js';

describe('quickstart node version gate', () => {
  it.each([
    { version: 'v20.10.0', supported: false },
    { version: 'v20.11.0', supported: true },
    { version: 'v21.0.0', supported: true },
    { version: 'v22.21.1', supported: true },
    { version: 'v19.9.0', supported: false },
    { version: 'invalid', supported: false },
  ])('reports $version supported=$supported', ({ version, supported }) => {
    expect(isNodeVersionSupported(version)).toBe(supported);
  });
});
