import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterStatus,
  createProjectScaffold,
  debugExecution,
  enqueueWorkflow,
  listPlugins,
  listWorkflows,
  runWorkflow,
  sandboxStatus,
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


test('project scaffold creates deterministic starter layout', () => {
  const projectName = 'tmp-platform-project';
  const created = createProjectScaffold(projectName);
  assert.ok(created.generated.some(p => p.endsWith('example-workflow.json')));
});

test('sandbox status reports deterministic local services', () => {
  const status = sandboxStatus();
  assert.equal(status.deterministic_mode, true);
  assert.equal(status.engine, 'local-ready');
});

test('debug execution returns graph and proof artifact links', () => {
  const run = runWorkflow('file_pipeline', { left: 'dbg', right: 'test' });
  const debug = debugExecution(run.run_id);
  assert.equal(debug.run_id, run.run_id);
  assert.ok(debug.execution_graph.length >= 1);
  assert.ok(debug.proof_artifacts.proofpack_path.endsWith('.proofpack.json'));
});

test('real workload templates run sequentially and via queue', () => {
  const workflows = ['api_data_pipeline', 'llm_agent_orchestration', 'file_ingestion_pipeline'];
  for (const wf of workflows) {
    const result = runWorkflow(wf, { url: 'https://example.invalid', left: 'x', right: 'y' });
    assert.ok(result.proofpack_path.includes('.proofpack.json'));
    enqueueWorkflow(wf, { url: 'https://example.invalid', left: 'x', right: 'y' });
  }
  const drain = workerStart('worker-concurrent', false);
  assert.ok(drain.processed >= workflows.length);
});
