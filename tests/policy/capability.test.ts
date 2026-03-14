import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

describe('capability command surface', () => {
  it('rejects verify when token file is missing', () => {
    const out = spawnSync('./build/requiem', ['cap', 'verify', '--token', '/nonexistent', '--action', 'exec.run', '--public-key', 'x'], { encoding: 'utf8' });
    assert.notEqual(out.status, 0);
  });
});
