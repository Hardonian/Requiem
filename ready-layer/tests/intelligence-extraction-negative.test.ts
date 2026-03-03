import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(testDir, 'fixtures/intelligence/extraction-malformed');

function copyFixtureTree(targetDir: string): void {
  const files = ['predictions.ndjson', 'outcomes.ndjson', 'economic_events.ndjson', 'artifacts.ndjson', 'cases.ndjson'];
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(fixtureDir, file), path.join(targetDir, file));
  }
}

describe('intelligence extraction malformed fixture behavior', () => {
  it('fails deterministically on schema-invalid enrichment rows', () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intelligence-extract-bad-'));
    copyFixtureTree(workDir);

    let message = '';
    try {
      execFileSync('node', ['scripts/run-tsx.mjs', 'scripts/extract-intelligence-cases.ts'], {
        cwd: path.resolve(testDir, '..', '..'),
        env: {
          ...process.env,
          REQUIEM_INTELLIGENCE_STORE_DIR: workDir,
        },
        stdio: 'pipe',
      });
      throw new Error('expected extraction script to fail on malformed fixture');
    } catch (error) {
      const stderr = error instanceof Error && 'stderr' in error ? String((error as { stderr?: Buffer }).stderr ?? '') : '';
      const combined = `${error instanceof Error ? error.message : String(error)}\n${stderr}`;
      message = combined;
    }

    expect(message).toContain('Schema validation failed for');
    expect(message).toContain('economic_events.ndjson line 1');
    expect(message).toContain('expected number, received string');
  });
});
