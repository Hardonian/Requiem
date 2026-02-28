/**
 * Differentiator Infrastructure Integrity Test
 *
 * Phase 7 — Market Maker Differentiation
 *
 * This is a structural integrity test. It verifies that Requiem's key differentiator
 * infrastructure is intact and has not regressed. It does NOT test business logic;
 * it tests that the differentiator scaffolding exists and is correctly wired.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

// Root of the repository (5 levels up from packages/ai/src/policy/__tests__)
const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..', '..', '..', '..', '..', '..');

function rootPath(...parts: string[]): string {
  return join(ROOT, ...parts);
}

// ---------------------------------------------------------------------------
// 1. Policy gate exists and exports evaluatePolicy
// ---------------------------------------------------------------------------
test('policy gate: exports evaluatePolicy', async () => {
  const gate = await import('../gate.js').catch(() => require('../gate'));
  assert.ok(typeof gate.evaluatePolicy === 'function', 'gate.ts must export evaluatePolicy()');
});

// ---------------------------------------------------------------------------
// 2. Guardrails are wired (gate imports guardrails)
// ---------------------------------------------------------------------------
test('guardrails: gate.ts imports guardrails module', () => {
  const gateSource = readFileSync(
    join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', 'gate.ts'),
    'utf8'
  );
  assert.ok(
    gateSource.includes('guardrails'),
    'gate.ts must import or reference the guardrails module'
  );
});

// ---------------------------------------------------------------------------
// 3. Budget checker exports Clock interface
// ---------------------------------------------------------------------------
test('budget checker: exports Clock interface or type', () => {
  const budgetsSource = readFileSync(
    join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', 'budgets.ts'),
    'utf8'
  );
  assert.ok(
    budgetsSource.includes('Clock'),
    'budgets.ts must export a Clock interface for testable time abstraction'
  );
});

// ---------------------------------------------------------------------------
// 4. Rate limiter is implemented (not a TODO stub)
// ---------------------------------------------------------------------------
test('rate limiter: implementation exists in budgets.ts (not a TODO stub)', () => {
  const budgetsSource = readFileSync(
    join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', 'budgets.ts'),
    'utf8'
  );
  // Should contain actual rate limiting logic, not just a TODO comment
  assert.ok(
    budgetsSource.includes('rate') || budgetsSource.includes('Rate') || budgetsSource.includes('limit'),
    'budgets.ts must contain rate limiting implementation'
  );
  // Must not be a pure stub
  const todoLines = (budgetsSource.match(/^\s*\/\/\s*TODO:/gm) || []).length;
  assert.ok(
    todoLines < 5,
    `budgets.ts has too many TODO stubs (${todoLines}); rate limiter must be implemented`
  );
});

// ---------------------------------------------------------------------------
// 5. Feature flags module exists and exports loadFlags
// ---------------------------------------------------------------------------
test('feature flags: exports loadFlags', async () => {
  const flags = await import('../../flags/index.js').catch(() => require('../../flags/index'));
  assert.ok(typeof flags.loadFlags === 'function', 'flags/index.ts must export loadFlags()');
});

// ---------------------------------------------------------------------------
// 6. Migration policy module exists and exports checkMigrationPolicy
// ---------------------------------------------------------------------------
test('migration policy: exports checkMigrationPolicy', async () => {
  const migration = await import('../migration.js').catch(() => require('../migration'));
  assert.ok(
    typeof migration.checkMigrationPolicy === 'function',
    'migration.ts must export checkMigrationPolicy()'
  );
});

// ---------------------------------------------------------------------------
// 7. Golden corpus files exist and are valid JSON
// ---------------------------------------------------------------------------
test('golden corpus: exec_request_canon.json exists and is valid JSON', () => {
  const p = rootPath('testdata', 'golden', 'exec_request_canon.json');
  assert.ok(existsSync(p), `golden corpus file not found: ${p}`);
  const raw = readFileSync(p, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw), 'exec_request_canon.json must be valid JSON');
});

test('golden corpus: policy_decision_canon.json exists and is valid JSON', () => {
  const p = rootPath('testdata', 'golden', 'policy_decision_canon.json');
  assert.ok(existsSync(p), `golden corpus file not found: ${p}`);
  const raw = readFileSync(p, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw), 'policy_decision_canon.json must be valid JSON');
});

test('golden corpus: budget_state_canon.json exists and is valid JSON', () => {
  const p = rootPath('testdata', 'golden', 'budget_state_canon.json');
  assert.ok(existsSync(p), `golden corpus file not found: ${p}`);
  const raw = readFileSync(p, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw), 'budget_state_canon.json must be valid JSON');
});

// ---------------------------------------------------------------------------
// 8. All 4 TLA+ spec files exist
// ---------------------------------------------------------------------------
const TLA_SPECS = [
  'formal/Determinism.tla',
  'formal/CAS.tla',
  'formal/Protocol.tla',
  'formal/Replay.tla',
];

for (const spec of TLA_SPECS) {
  test(`TLA+ spec exists: ${spec}`, () => {
    const p = rootPath(spec);
    assert.ok(existsSync(p), `TLA+ spec missing: ${spec}`);
    const content = readFileSync(p, 'utf8');
    assert.ok(content.length > 100, `TLA+ spec appears empty: ${spec}`);
    assert.ok(
      content.includes('MODULE') || content.includes('VARIABLES') || content.includes('INIT'),
      `File does not look like a valid TLA+ spec: ${spec}`
    );
  });
}

// ---------------------------------------------------------------------------
// 9. Determinism contract has ai_layer section
// ---------------------------------------------------------------------------
test('determinism contract: has ai_layer section', () => {
  const p = rootPath('contracts', 'determinism.contract.json');
  assert.ok(existsSync(p), `determinism contract not found: ${p}`);
  const contract = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(
    contract.ai_layer !== undefined,
    'contracts/determinism.contract.json must contain an ai_layer section'
  );
});

// ---------------------------------------------------------------------------
// 10. Theatre audit document exists
// ---------------------------------------------------------------------------
test('theatre audit: docs/THEATRE_AUDIT.md exists', () => {
  const p = rootPath('docs', 'THEATRE_AUDIT.md');
  assert.ok(existsSync(p), `theatre audit document not found: ${p}`);
  const content = readFileSync(p, 'utf8');
  assert.ok(content.length > 500, 'THEATRE_AUDIT.md appears to be empty or truncated');
  // Should contain an implementation status table
  assert.ok(
    content.includes('implemented') || content.includes('stub') || content.includes('Status'),
    'THEATRE_AUDIT.md must contain implementation status information'
  );
});

// ---------------------------------------------------------------------------
// BONUS: Competitive matrix exists and is parseable
// ---------------------------------------------------------------------------
test('competitive matrix: contracts/competitive.matrix.json exists and is valid', () => {
  const p = rootPath('contracts', 'competitive.matrix.json');
  assert.ok(existsSync(p), `competitive matrix not found: ${p}`);
  const matrix = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(matrix.capabilities), 'competitive.matrix.json must have capabilities array');
  assert.ok(matrix.capabilities.length >= 8, `at least 8 capabilities required, found ${matrix.capabilities.length}`);
});
