import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterStatus,
  enqueueWorkflow,
  listPlugins,
  listWorkflows,
  runWorkflow,
  setPluginEnabled,
  workerStart,
} from './workflow-platform.js';

test('workflow runs are deterministic for same input', () => {
  const a = runWorkflow('file_pipeline', { left: 'a', right: 'b' });
  const b = runWorkflow('file_pipeline', { left: 'a', right: 'b' });
  assert.equal(a.state_hash, b.state_hash);
  assert.equal(a.result_digest, b.result_digest);
});

test('plugin registry toggles enabled state', () => {
  setPluginEnabled('sample-transform', true);
  const enabled = listPlugins().find(p => p.name === 'sample-transform');
  assert.equal(enabled?.enabled, true);
  setPluginEnabled('sample-transform', false);
  const disabled = listPlugins().find(p => p.name === 'sample-transform');
  assert.equal(disabled?.enabled, false);
});

test('distributed queue drains deterministically', () => {
  const wf = listWorkflows();
  assert.ok(wf.includes('file_pipeline.json'));
  enqueueWorkflow('file_pipeline', { left: 'x', right: 'y' });
  const worker = workerStart('worker-test', true);
  assert.equal(worker.worker_id, 'worker-test');
  const status = clusterStatus();
  assert.ok(status.completed >= 1);
});
