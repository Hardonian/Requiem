import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('audit append-only semantics', () => {
  it('preserves old lines when appending new entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rq-audit-'));
    const p = join(dir, 'audit.ndjson');
    appendFileSync(p, '{"seq":1}\n', 'utf8');
    const before = readFileSync(p, 'utf8');
    appendFileSync(p, '{"seq":2}\n', 'utf8');
    const after = readFileSync(p, 'utf8');
    assert.ok(after.startsWith(before));
    assert.equal(after.trim().split('\n').length, 2);
  });
});
