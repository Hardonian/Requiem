import fs from 'node:fs';
import path from 'node:path';
import { casContentHash, hash, policyProofHash, requestDigest, resultDigest } from './hash.js';
import { stableSortKeys } from '../core/cli-helpers.js';

export type WorkflowNodeType = 'task' | 'adapter' | 'subworkflow';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  action: string;
  inputs?: Record<string, unknown>;
  depends_on?: string[];
  policy_hook?: string;
  output_key?: string;
}

export interface WorkflowDefinition {
  metadata: { name: string; version: string; description?: string };
  inputs_schema: { required?: string[]; properties?: Record<string, unknown> };
  execution_graph: WorkflowNode[];
  policy_hooks?: Record<string, { effect: 'allow' | 'deny'; reason?: string }>;
  expected_outputs?: string[];
}

interface PluginDescriptor {
  name: string;
  version: string;
  enabledByDefault?: boolean;
  adapters?: Record<string, { type: 'echo' | 'concat'; prefix?: string }>;
}

interface WorkflowExecutionEvent {
  seq: number;
  type: 'policy' | 'node' | 'checkpoint';
  node_id?: string;
  detail_hash: string;
  state_hash: string;
}


export interface DebugSnapshot {
  run_id: string;
  workflow: string;
  execution_graph: WorkflowNode[];
  adapter_calls: Array<{ seq: number; node_id: string; action: string; detail_hash: string }>;
  policy_decisions: Array<{ seq: number; node_id: string; decision_hash: string }>;
  state_transitions: Array<{ seq: number; state_hash: string }>;
  proof_artifacts: { proofpack_path: string; replay_log_path: string; cas_digest?: string };
}
export interface WorkflowRunResult {
  workflow: string;
  run_id: string;
  result: Record<string, unknown>;
  state_hash: string;
  request_digest: string;
  result_digest: string;
  proofpack_path: string;
  replay_log_path: string;
}

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, 'workflows');
const PLUGIN_DIR = path.join(ROOT, 'plugins');
const STATE_DIR = path.join(ROOT, '.requiem', 'platform');
const CAS_DIR = path.join(ROOT, '.requiem', 'cas', 'objects');
const PROOFPACK_DIR = path.join(ROOT, 'proofpacks', 'workflows');
const CLUSTER_DIR = path.join(STATE_DIR, 'cluster');

function ensureDir(p: string): void { fs.mkdirSync(p, { recursive: true }); }

function deterministic<T>(v: T): T { return stableSortKeys(v) as T; }

function readJsonFile<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJsonFile(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(deterministic(value), null, 2));
}

function casWrite(value: unknown): { digest: string; objectPath: string } {
  const payload = JSON.stringify(deterministic(value));
  const digest = casContentHash(payload);
  const objectPath = path.join(CAS_DIR, digest.slice(0, 2), digest.slice(2));
  ensureDir(path.dirname(objectPath));
  fs.writeFileSync(objectPath, payload);
  return { digest, objectPath };
}

function pluginStatePath(): string { return path.join(STATE_DIR, 'plugins-state.json'); }

function loadPluginState(): { enabled: string[] } {
  const p = pluginStatePath();
  if (!fs.existsSync(p)) return { enabled: [] };
  return readJsonFile<{ enabled: string[] }>(p);
}

function savePluginState(state: { enabled: string[] }): void {
  writeJsonFile(pluginStatePath(), state);
}

function listPluginDescriptors(): Array<PluginDescriptor & { path: string; enabled: boolean }> {
  ensureDir(PLUGIN_DIR);
  const state = loadPluginState();
  return fs.readdirSync(PLUGIN_DIR)
    .map(name => path.join(PLUGIN_DIR, name))
    .filter(p => fs.statSync(p).isDirectory())
    .map(dir => {
      const descriptor = readJsonFile<PluginDescriptor>(path.join(dir, 'plugin.json'));
      const enabled = state.enabled.includes(descriptor.name) || (!!descriptor.enabledByDefault && !state.enabled.includes(`!${descriptor.name}`));
      return { ...descriptor, path: dir, enabled };
    });
}

function pluginAdapters(): Record<string, (input: Record<string, unknown>) => unknown> {
  const adapters: Record<string, (input: Record<string, unknown>) => unknown> = {};
  for (const plugin of listPluginDescriptors().filter(p => p.enabled && p.adapters)) {
    for (const [adapterName, cfg] of Object.entries(plugin.adapters ?? {})) {
      adapters[adapterName] = (input) => {
        if (cfg.type === 'echo') {
          return { text: `${cfg.prefix ?? ''}${String(input['text'] ?? input['value'] ?? '')}` };
        }
        const left = String(input['left'] ?? '');
        const right = String(input['right'] ?? '');
        return { text: `${cfg.prefix ?? ''}${left}${right}` };
      };
    }
  }
  return adapters;
}

export function listWorkflows(): string[] {
  ensureDir(WORKFLOW_DIR);
  return fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json')).sort();
}

export function inspectWorkflow(name: string): WorkflowDefinition {
  const file = path.join(WORKFLOW_DIR, name.endsWith('.json') ? name : `${name}.json`);
  return readJsonFile<WorkflowDefinition>(file);
}

function resolveInputs(nodeInputs: Record<string, unknown> | undefined, state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nodeInputs ?? {})) {
    if (typeof v === 'string' && v.startsWith('$')) {
      out[k] = state[v.slice(1)];
    } else {
      out[k] = v;
    }
  }
  return out;
}

function validatePolicy(def: WorkflowDefinition, hookName: string | undefined): { allowed: boolean; hash: string; reason: string } {
  if (!hookName) return { allowed: true, hash: policyProofHash('{"effect":"allow","reason":"none"}'), reason: 'no-hook' };
  const hook = def.policy_hooks?.[hookName];
  if (!hook) return { allowed: true, hash: policyProofHash('{"effect":"allow","reason":"missing-hook"}'), reason: 'missing-hook' };
  const hashValue = policyProofHash(JSON.stringify(deterministic(hook)));
  return { allowed: hook.effect !== 'deny', hash: hashValue, reason: hook.reason ?? 'policy' };
}

function runNode(def: WorkflowDefinition, node: WorkflowNode, state: Record<string, unknown>, adapters: Record<string, (input: Record<string, unknown>) => unknown>): unknown {
  const inputs = resolveInputs(node.inputs, state);
  if (node.type === 'task') {
    if (node.action === 'set') return inputs;
    if (node.action === 'select') return inputs['value'] ?? null;
    return inputs;
  }
  if (node.type === 'adapter') {
    const adapter = adapters[node.action];
    if (!adapter) throw new Error(`Adapter not found: ${node.action}`);
    return adapter(inputs);
  }
  const nested = runWorkflow(node.action, inputs as Record<string, unknown>);
  return nested.result;
}

export function runWorkflow(name: string, input: Record<string, unknown>): WorkflowRunResult {
  const def = inspectWorkflow(name);
  const request = deterministic({ workflow: name, input });
  const reqDigest = requestDigest(JSON.stringify(request));
  const state: Record<string, unknown> = { ...input };
  const adapters: Record<string, (input: Record<string, unknown>) => unknown> = {
    'builtin.echo': (i) => ({ text: String(i['text'] ?? '') }),
    'builtin.concat': (i) => ({ text: `${String(i['left'] ?? '')}${String(i['right'] ?? '')}` }),
    'llm_mock.complete': (i) => ({ text: `mock:${String(i['text'] ?? '')}` }),
    ...pluginAdapters(),
  };

  const events: WorkflowExecutionEvent[] = [];
  let prevStateHash = hash('state:genesis');
  let seq = 0;

  for (const node of def.execution_graph) {
    if ((node.depends_on ?? []).some(dep => !(dep in state))) {
      throw new Error(`Dependency missing for node ${node.id}`);
    }
    const policy = validatePolicy(def, node.policy_hook);
    events.push({ seq: seq++, type: 'policy', node_id: node.id, detail_hash: policy.hash, state_hash: prevStateHash });
    if (!policy.allowed) throw new Error(`Policy denied at node ${node.id}: ${policy.reason}`);

    const output = runNode(def, node, state, adapters);
    state[node.output_key ?? node.id] = output;
    const nodeHash = hash(JSON.stringify(deterministic({ node: node.id, output })));
    prevStateHash = hash(`${prevStateHash}:${nodeHash}`);
    events.push({ seq: seq++, type: 'node', node_id: node.id, detail_hash: nodeHash, state_hash: prevStateHash });
  }

  events.push({ seq: seq++, type: 'checkpoint', detail_hash: hash(JSON.stringify(deterministic(state))), state_hash: prevStateHash });

  const result = deterministic({ state, expected_outputs: def.expected_outputs ?? [] });
  const resDigest = resultDigest(JSON.stringify(result));
  const runId = `wf_${casContentHash(`${name}:${reqDigest}:${resDigest}`).slice(0, 16)}`;

  const casRef = casWrite(result);
  const replayLog = { run_id: runId, workflow: name, events, final_state_hash: prevStateHash, cas_digest: casRef.digest };
  const replayPath = path.join(PROOFPACK_DIR, `${runId}.replay.json`);
  writeJsonFile(replayPath, replayLog);

  const proofpack = deterministic({
    manifest: {
      run_id: runId,
      workflow: name,
      request_digest: reqDigest,
      result_digest: resDigest,
      state_hash: prevStateHash,
      cas_digest: casRef.digest,
    },
    replay_log: replayLog,
    result,
  });
  const proofpackPath = path.join(PROOFPACK_DIR, `${runId}.proofpack.json`);
  writeJsonFile(proofpackPath, proofpack);

  return { workflow: name, run_id: runId, result: result as Record<string, unknown>, state_hash: prevStateHash, request_digest: reqDigest, result_digest: resDigest, proofpack_path: proofpackPath, replay_log_path: replayPath };
}


export function createProjectScaffold(projectName: string): { project_path: string; generated: string[] } {
  const sanitized = projectName.trim();
  if (!sanitized || /[\\/]/.test(sanitized)) {
    throw new Error('Project name must be a single directory name');
  }

  const projectRoot = path.join(ROOT, sanitized);
  const dirs = ['workflows', 'policies', 'adapters', 'config'];
  for (const dir of dirs) ensureDir(path.join(projectRoot, dir));

  const exampleWorkflow: WorkflowDefinition = deterministic({
    metadata: { name: 'example_workflow', version: '1.0.0', description: 'Scaffolded deterministic starter workflow' },
    inputs_schema: {
      required: ['message'],
      properties: { message: { type: 'string' } },
    },
    execution_graph: [
      { id: 'echo', type: 'adapter', action: 'builtin.echo', inputs: { text: '$message' }, policy_hook: 'allow_default', output_key: 'echoed' },
    ],
    policy_hooks: { allow_default: { effect: 'allow', reason: 'scaffold default policy' } },
    expected_outputs: ['echoed'],
  });

  const workflowPath = path.join(projectRoot, 'example-workflow.json');
  writeJsonFile(workflowPath, exampleWorkflow);

  const configPath = path.join(projectRoot, 'config', 'project.json');
  writeJsonFile(configPath, {
    name: sanitized,
    created_by: 'requiem new',
    deterministic_defaults: true,
  });

  return {
    project_path: projectRoot,
    generated: [
      ...dirs.map(dir => path.join(projectRoot, dir)),
      workflowPath,
      configPath,
    ],
  };
}

export function sandboxStatus(): {
  engine: string;
  cas: string;
  policy_engine: string;
  web_console: string;
  deterministic_mode: boolean;
} {
  ensureDir(path.join(ROOT, '.requiem'));
  ensureDir(path.join(ROOT, '.requiem', 'cas'));
  ensureDir(path.join(ROOT, '.requiem', 'platform'));
  return {
    engine: 'local-ready',
    cas: '.requiem/cas',
    policy_engine: 'enforced',
    web_console: 'http://localhost:4173/console (placeholder)',
    deterministic_mode: true,
  };
}

export function debugExecution(runId: string): DebugSnapshot {
  const proofpackPath = path.join(PROOFPACK_DIR, `${runId}.proofpack.json`);
  const replayPath = path.join(PROOFPACK_DIR, `${runId}.replay.json`);
  const proof = readJsonFile<{
    manifest: { workflow: string; cas_digest?: string };
    replay_log: {
      events: WorkflowExecutionEvent[];
      run_id: string;
    };
  }>(proofpackPath);

  const workflow = inspectWorkflow(proof.manifest.workflow);
  const events = proof.replay_log.events ?? [];

  return deterministic({
    run_id: runId,
    workflow: proof.manifest.workflow,
    execution_graph: workflow.execution_graph,
    adapter_calls: events
      .filter(event => event.type === 'node')
      .map(event => ({
        seq: event.seq,
        node_id: event.node_id ?? 'unknown',
        action: workflow.execution_graph.find(node => node.id === event.node_id)?.action ?? 'unknown',
        detail_hash: event.detail_hash,
      })),
    policy_decisions: events
      .filter(event => event.type === 'policy')
      .map(event => ({ seq: event.seq, node_id: event.node_id ?? 'unknown', decision_hash: event.detail_hash })),
    state_transitions: events.map(event => ({ seq: event.seq, state_hash: event.state_hash })),
    proof_artifacts: {
      proofpack_path: proofpackPath,
      replay_log_path: replayPath,
      cas_digest: proof.manifest.cas_digest,
    },
  });
}

export function replayWorkflow(runId: string): { deterministic: boolean; state_hash: string } {
  const proof = readJsonFile<{ manifest: { workflow: string }, result: { state: Record<string, unknown> }, replay_log: { final_state_hash: string } }>(path.join(PROOFPACK_DIR, `${runId}.proofpack.json`));
  const rerun = runWorkflow(proof.manifest.workflow, proof.result.state);
  return { deterministic: rerun.state_hash === proof.replay_log.final_state_hash, state_hash: rerun.state_hash };
}

export function listPlugins(): Array<{ name: string; version: string; enabled: boolean; path: string }> {
  return listPluginDescriptors().map(({ name, version, enabled, path: pluginPath }) => ({ name, version, enabled, path: pluginPath }));
}

export function installPlugin(sourcePath: string): { installed: string } {
  const descriptor = readJsonFile<PluginDescriptor>(path.join(sourcePath, 'plugin.json'));
  const target = path.join(PLUGIN_DIR, descriptor.name);
  ensureDir(PLUGIN_DIR);
  fs.cpSync(sourcePath, target, { recursive: true, force: true });
  return { installed: descriptor.name };
}

export function setPluginEnabled(name: string, enabled: boolean): { name: string; enabled: boolean } {
  const state = loadPluginState();
  const marker = `!${name}`;
  state.enabled = state.enabled.filter(v => v !== name && v !== marker);
  state.enabled.push(enabled ? name : marker);
  savePluginState(state);
  return { name, enabled };
}

interface QueueTask { id: string; workflow: string; input: Record<string, unknown>; status: 'pending' | 'done'; worker_id?: string; }

function queuePath(): string { return path.join(CLUSTER_DIR, 'queue.json'); }
function workerStatusPath(): string { return path.join(CLUSTER_DIR, 'workers.json'); }
function resultsPath(): string { return path.join(CLUSTER_DIR, 'results.json'); }

function loadTasks(): QueueTask[] {
  const p = queuePath();
  if (!fs.existsSync(p)) return [];
  return readJsonFile<QueueTask[]>(p);
}

function saveTasks(tasks: QueueTask[]): void { writeJsonFile(queuePath(), tasks); }

export function enqueueWorkflow(workflow: string, input: Record<string, unknown>): QueueTask {
  const tasks = loadTasks();
  const id = `task_${casContentHash(JSON.stringify(deterministic({ workflow, input, idx: tasks.length }))).slice(0, 12)}`;
  const task: QueueTask = { id, workflow, input, status: 'pending' };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

export function workerStart(workerId: string, once = true): { processed: number; worker_id: string } {
  ensureDir(CLUSTER_DIR);
  const tasks = loadTasks();
  const results = fs.existsSync(resultsPath()) ? readJsonFile<Array<{ task_id: string; run_id: string; state_hash: string }>>(resultsPath()) : [];
  let processed = 0;
  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    const run = runWorkflow(task.workflow, task.input);
    task.status = 'done';
    task.worker_id = workerId;
    results.push({ task_id: task.id, run_id: run.run_id, state_hash: run.state_hash });
    processed += 1;
    if (once) break;
  }
  saveTasks(tasks);
  writeJsonFile(resultsPath(), results);
  const workers = fs.existsSync(workerStatusPath()) ? readJsonFile<Record<string, { processed: number; last_seen: string }>>(workerStatusPath()) : {};
  workers[workerId] = { processed: (workers[workerId]?.processed ?? 0) + processed, last_seen: new Date(0).toISOString() };
  writeJsonFile(workerStatusPath(), workers);
  return { processed, worker_id: workerId };
}

export function workerStatus(): Record<string, { processed: number; last_seen: string }> {
  if (!fs.existsSync(workerStatusPath())) return {};
  return readJsonFile<Record<string, { processed: number; last_seen: string }>>(workerStatusPath());
}

export function clusterStatus(): { queued: number; completed: number; workers: number; deterministic_replay_ready: boolean } {
  const tasks = loadTasks();
  const workers = workerStatus();
  const completed = tasks.filter(t => t.status === 'done').length;
  return { queued: tasks.filter(t => t.status === 'pending').length, completed, workers: Object.keys(workers).length, deterministic_replay_ready: true };
}
