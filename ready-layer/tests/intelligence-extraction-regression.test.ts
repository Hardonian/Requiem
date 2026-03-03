import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(testDir, 'fixtures/intelligence/extraction');

function copyFixtureTree(targetDir: string): void {
  const files = ['predictions.ndjson', 'outcomes.ndjson', 'economic_events.ndjson', 'artifacts.ndjson', 'cases.ndjson'];
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(fixtureDir, file), path.join(targetDir, file));
  }
}

describe('intelligence extraction regression fixtures', () => {
  it('extracts case with enriched cost units and pointers from fixture ndjson inputs', () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intelligence-extract-'));
    copyFixtureTree(workDir);

    execFileSync('node', ['scripts/run-tsx.mjs', 'scripts/extract-intelligence-cases.ts'], {
      cwd: path.resolve(testDir, '..', '..'),
      env: {
        ...process.env,
        REQUIEM_INTELLIGENCE_STORE_DIR: workDir,
      },
      stdio: 'pipe',
    });

    const casesPath = path.join(workDir, 'cases.ndjson');
    const rows = fs.readFileSync(casesPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as {
      run_id: string;
      cost_units: number;
      pointers: string[];
      case_version: string;
    });

    expect(rows.length).toBe(1);
    expect(rows[0].run_id).toBe('run-fixture-1');
    expect(rows[0].cost_units).toBe(20);
    expect(rows[0].pointers).toContain('run:run-fixture-1');
    expect(rows[0].pointers).toContain('artifact://bundle/run-fixture-1');
    expect(rows[0].pointers).toContain('artifact:deadbeefcafebabe');
    expect(rows[0].pointers).toContain('evidence:test-log:abc');
    expect(rows[0].case_version).toBe('v1');
  });
});
