import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRepairPlan,
  classifyFailure,
  computeEnvFingerprint,
  diffRunToolEvents,
  exportIncidentPack,
  hashArgs,
  normalizeError,
  preflightTool,
  recordToolEvent,
  buildRepairPlan,
} from '../failureRuntime.js';

describe('tool failure runtime classifier', () => {
  const fixtures: Array<{ error: string; cls: string; sub: string }> = [
    { error: 'permission denied by RLS policy', cls: 'permission_error', sub: 'rls_denied' },
    { error: 'missing scope: repo.write', cls: 'permission_error', sub: 'oauth_scope_missing' },
    { error: 'ENOENT binary not found', cls: 'dependency_error', sub: 'binary_missing' },
    { error: 'env missing OPENAI_API_KEY', cls: 'dependency_error', sub: 'env_var_missing' },
    { error: 'schema validation failed', cls: 'interface_error', sub: 'schema_mismatch' },
    { error: '429 rate limit exceeded', cls: 'rate_limit_error', sub: 'http_429' },
    { error: 'request timeout after 1000ms', cls: 'timeout_error', sub: 'deadline_exceeded' },
    { error: 'guardrail policy denied tool', cls: 'guardrail_block', sub: 'policy_denied' },
    { error: 'determinism mismatch on replay', cls: 'determinism_break', sub: 'replay_mismatch' },
    { error: 'cas artifact missing', cls: 'storage_error', sub: 'artifact_missing' },
    { error: 'partial execution after write', cls: 'partial_execution_error', sub: 'step_failed_after_side_effect' },
    { error: 'ECONNREFUSED network unreachable', cls: 'network_error', sub: 'network_unreachable' },
    { error: 'deadlock concurrency issue', cls: 'concurrency_error', sub: 'lock_contention' },
    { error: 'invalid plan step', cls: 'planning_error', sub: 'invalid_plan' },
  ];

  for (const fixture of fixtures) {
    it(`classifies ${fixture.sub}`, () => {
      const result = classifyFailure('tool.test', fixture.error);
      assert.equal(result.failure_class, fixture.cls);
      assert.equal(result.failure_subclass, fixture.sub);
      assert.ok(result.diagnosis.cause.length > 4);
    });
  }

  it('is deterministic for same input', () => {
    const a = classifyFailure('tool.test', 'env missing SECRET_TOKEN');
    const b = classifyFailure('tool.test', 'env missing SECRET_TOKEN');
    assert.deepEqual(a, b);
  });
});

describe('tool failure runtime integration', () => {
  it('records events, generates repair fingerprint, and exports proof', () => {
    const env = computeEnvFingerprint();
    const classification = classifyFailure('tool.test', 'env missing REQUIRED_VAR');
    const repair = buildRepairPlan(classification);

    const event = recordToolEvent({
      run_id: 'run-fixture-a',
      trace_id: 'run-fixture-a',
      tool_name: 'tool.test',
      tool_version: '1.0.0',
      args_hash: hashArgs({ a: 1 }),
      args_redacted_preview: '{"a":1}',
      start_ts: 1,
      duration_ms: 10,
      status: 'failed',
      raw_error: 'env missing REQUIRED_VAR',
      normalized_error: normalizeError('env missing REQUIRED_VAR'),
      failure_class: classification.failure_class,
      failure_subclass: classification.failure_subclass,
      diagnosis: classification.diagnosis,
      repair_plan: repair,
      retry_recommendation: 'manual-review',
      env_fingerprint_id: env.id,
      policy_fingerprint_id: env.policy_bundle_hash,
      artifact_refs: [],
    });

    assert.ok(event.event_id.length > 8);
    assert.ok(repair.fingerprint.length > 12);

    const replayed = exportIncidentPack('run-fixture-a');
    assert.equal(replayed.run_id, 'run-fixture-a');
    assert.equal(replayed.tool_events[0]?.failure_class, 'dependency_error');
  });

  it('diff detects changed classes across runs', () => {
    const env = computeEnvFingerprint();
    for (const [run, error] of [['run-fixture-b', '429 rate limit exceeded'], ['run-fixture-c', 'schema mismatch']] as const) {
      const c = classifyFailure('tool.test', error);
      recordToolEvent({
        run_id: run,
        trace_id: run,
        tool_name: 'tool.test',
        tool_version: '1.0.0',
        args_hash: hashArgs({ run }),
        args_redacted_preview: '{"run":"x"}',
        start_ts: 2,
        duration_ms: 5,
        status: 'failed',
        raw_error: error,
        normalized_error: normalizeError(error),
        failure_class: c.failure_class,
        failure_subclass: c.failure_subclass,
        diagnosis: c.diagnosis,
        repair_plan: buildRepairPlan(c),
        retry_recommendation: 'manual-review',
        env_fingerprint_id: env.id,
        policy_fingerprint_id: env.policy_bundle_hash,
        artifact_refs: [],
      });
    }

    const diff = diffRunToolEvents('run-fixture-b', 'run-fixture-c');
    assert.deepEqual(diff.changed_classes, ['tool.test']);
  });

  it('preflight + apply never auto escalate', () => {
    const preflight = preflightTool('tool.test');
    assert.ok(['PASS', 'WARN', 'FAIL'].includes(preflight.status));

    const dryRun = applyRepairPlan('run-fixture-a', false);
    assert.equal(dryRun.applied, false);
    assert.match(dryRun.message, /Dry-run/);
  });
});
