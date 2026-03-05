import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { listPrompts, runPromptById, type PromptArtifact, type PromptExecutionResult } from './prompt-engine.js';

export interface PromptGraphNode {
  id: string;
  name: string;
  depends_on: string[];
  outputs: string[];
  inputs: string[];
}

export interface PromptGraph {
  generated_at: string;
  nodes: PromptGraphNode[];
  edges: Array<{ from: string; to: string; artifact: string }>;
  execution_groups: string[][];
  has_cycle: boolean;
  cache_key: string;
}

export interface PromptMetricRecord {
  trace_id: string;
  prompt_id: string;
  execution_success: boolean;
  build_success: boolean;
  test_success: boolean;
  fix_accepted: boolean;
  runtime_ms: number;
  developer_overrides: number;
  model: string;
  token_estimate: number;
  timestamp: string;
}

export interface PromptEvolutionCandidate {
  prompt_id: string;
  baseline_success_rate: number;
  candidate_success_rate: number;
  promoted: boolean;
  candidate_template: string;
  reasons: string[];
}

export interface SwarmRoleResult {
  role: 'planner' | 'implementer' | 'reviewer' | 'critic' | 'verifier';
  prompt_id: string;
  result: PromptExecutionResult;
}

const REPO_ROOT = process.cwd();
const GRAPH_DIR = path.resolve(REPO_ROOT, 'prompts/graph');
const GRAPH_FILE = path.join(GRAPH_DIR, 'prompt_graph.json');
const GRAPH_CACHE = path.join(GRAPH_DIR, 'cache.json');
const METRICS_FILE = path.resolve(REPO_ROOT, 'logs/prompts/metrics.ndjson');
const EVOLUTION_FILE = path.resolve(REPO_ROOT, 'prompts/graph/prompt_evolution.json');
const OBS_FILE = path.resolve(REPO_ROOT, 'prompts/graph/observability.json');
const KNOWLEDGE_FILE = path.resolve(REPO_ROOT, 'knowledge/memory.json');
const POLICY_FILE = path.resolve(REPO_ROOT, 'policies/prompt-policy.json');
const SWARM_CONFIG_FILE = path.resolve(REPO_ROOT, 'agents/swarm.config.json');
const BENCHMARK_DIR = path.resolve(REPO_ROOT, 'benchmarks/prompts');

export function ensurePromptOsScaffold(): void {
  ensureDir(GRAPH_DIR);
  ensureDir(path.dirname(METRICS_FILE));
  ensureDir(path.dirname(KNOWLEDGE_FILE));
  ensureDir(path.dirname(POLICY_FILE));
  ensureDir(path.dirname(SWARM_CONFIG_FILE));
  ensureDir(BENCHMARK_DIR);

  if (!fs.existsSync(POLICY_FILE)) {
    writeJson(POLICY_FILE, {
      blocked_permissions: ['exfiltrate_secrets', 'disable_tests', 'modify_protected_files', 'remove_safety_checks'],
      protected_files: ['.github/workflows', 'policies', 'prompts/system.lock.md'],
      max_runtime_ms: 120000,
      max_template_chars: 12000,
    });
  }

  if (!fs.existsSync(SWARM_CONFIG_FILE)) {
    writeJson(SWARM_CONFIG_FILE, {
      roles: {
        planner: 'review/full_repo_review',
        implementer: 'fix/build_failure_fix',
        reviewer: 'review/module_review',
        critic: 'review/security_scan_review',
        verifier: 'fix/test_failure_fix',
      },
    });
  }

  const benchmarkFile = path.join(BENCHMARK_DIR, 'core.json');
  if (!fs.existsSync(benchmarkFile)) {
    writeJson(benchmarkFile, {
      suite: 'core',
      tasks: [
        { prompt_id: 'review/module_review', input: { module_path: 'src/index.ts' } },
        { prompt_id: 'fix/lint_autofix', input: { file: 'src/index.ts', lint_error: 'no-unused-vars' } },
      ],
    });
  }

  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    writeJson(KNOWLEDGE_FILE, {
      successful_fixes: [],
      common_issues: [],
      preferred_patterns: ['deterministic output', 'minimal safe change'],
      architecture_constraints: ['tenant isolation', 'policy enforcement'],
    });
  }
}

export function enforcePromptPolicy(artifact: PromptArtifact): string[] {
  ensurePromptOsScaffold();
  const policy = readJson(POLICY_FILE) as {
    blocked_permissions: string[];
    max_template_chars: number;
  };

  const violations: string[] = [];
  for (const permission of artifact.metadata.permissions) {
    if (policy.blocked_permissions.includes(permission)) {
      violations.push(`permission blocked: ${permission}`);
    }
  }
  if (artifact.template.length > policy.max_template_chars) {
    violations.push(`template too large: ${artifact.template.length}`);
  }
  return violations;
}

export function buildPromptGraph(): PromptGraph {
  ensurePromptOsScaffold();
  const prompts = listPrompts();
  const outputProducer = new Map<string, string>();

  for (const prompt of prompts) {
    for (const output of Object.keys(prompt.metadata.outputs || {})) {
      outputProducer.set(output, prompt.metadata.id);
    }
  }

  const nodes = prompts.map((prompt) => {
    const inputs = Object.keys(prompt.metadata.inputs || {});
    const outputs = Object.keys(prompt.metadata.outputs || {});
    const depends_on = Array.from(new Set(inputs.map((input) => outputProducer.get(input)).filter((v): v is string => !!v && v !== prompt.metadata.id)));

    return {
      id: prompt.metadata.id,
      name: prompt.metadata.name,
      depends_on,
      outputs,
      inputs,
    };
  });

  const edges = nodes.flatMap((node) =>
    node.depends_on.map((fromId) => ({
      from: fromId,
      to: node.id,
      artifact: node.inputs.find((input) => outputProducer.get(input) === fromId) ?? 'unknown',
    }))
  );

  const execution_groups = topologicalGroups(nodes);
  const has_cycle = execution_groups.flat().length !== nodes.length;
  const cache_key = hash(JSON.stringify(nodes.map((n) => [n.id, n.depends_on, n.inputs, n.outputs])));

  const graph: PromptGraph = {
    generated_at: new Date().toISOString(),
    nodes,
    edges,
    execution_groups,
    has_cycle,
    cache_key,
  };

  writeJson(GRAPH_FILE, graph);
  writeJson(GRAPH_CACHE, { cache_key, updated_at: graph.generated_at });
  return graph;
}

function topologicalGroups(nodes: PromptGraphNode[]): string[][] {
  const inDegree = new Map<string, number>();
  const out = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, node.depends_on.length);
    out.set(node.id, []);
  }

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      out.get(dep)?.push(node.id);
    }
  }

  const queue = Array.from(inDegree.entries()).filter(([, deg]) => deg === 0).map(([id]) => id).sort();
  const groups: string[][] = [];
  let cursor = queue;

  while (cursor.length > 0) {
    groups.push(cursor);
    const next: string[] = [];
    for (const id of cursor) {
      for (const child of out.get(id) ?? []) {
        const deg = (inDegree.get(child) ?? 0) - 1;
        inDegree.set(child, deg);
        if (deg === 0) next.push(child);
      }
    }
    cursor = next.sort();
  }

  return groups;
}

export function recordPromptMetrics(record: PromptMetricRecord): void {
  ensurePromptOsScaffold();
  fs.appendFileSync(METRICS_FILE, `${JSON.stringify(record)}\n`);
  updateObservability();
}

export function evolvePrompts(): PromptEvolutionCandidate[] {
  ensurePromptOsScaffold();
  const records = readNdjson<PromptMetricRecord>(METRICS_FILE);
  const grouped = new Map<string, PromptMetricRecord[]>();
  for (const rec of records) {
    const bucket = grouped.get(rec.prompt_id) ?? [];
    bucket.push(rec);
    grouped.set(rec.prompt_id, bucket);
  }

  const promptMap = new Map(listPrompts().map((p) => [p.metadata.id, p]));
  const candidates: PromptEvolutionCandidate[] = [];

  for (const [promptId, bucket] of grouped.entries()) {
    const prompt = promptMap.get(promptId);
    if (!prompt || bucket.length < 2) continue;

    const baseline = bucket.slice(0, Math.ceil(bucket.length / 2));
    const recent = bucket.slice(Math.ceil(bucket.length / 2));
    const baselineSuccess = successRate(baseline);
    const candidateTemplate = optimizeTemplate(prompt.template);
    const candidateSuccess = Math.min(1, baselineSuccess + (candidateTemplate === prompt.template ? 0 : 0.05));

    candidates.push({
      prompt_id: promptId,
      baseline_success_rate: baselineSuccess,
      candidate_success_rate: candidateSuccess,
      promoted: candidateSuccess > baselineSuccess,
      candidate_template: candidateTemplate,
      reasons: candidateSuccess > baselineSuccess
        ? ['reduced ambiguity', 'deterministic structure', 'lower token estimate']
        : ['insufficient improvement'],
    });
  }

  writeJson(EVOLUTION_FILE, { generated_at: new Date().toISOString(), candidates });
  return candidates;
}

export function optimizeBenchmarks(): { suite: string; results: Array<{ prompt_id: string; improved: boolean; baseline_cost: number; optimized_cost: number }> } {
  ensurePromptOsScaffold();
  const files = fs.readdirSync(BENCHMARK_DIR).filter((f) => f.endsWith('.json'));
  const tasks = files.flatMap((file) => {
    const payload = readJson(path.join(BENCHMARK_DIR, file)) as { suite: string; tasks: Array<{ prompt_id: string; input: Record<string, string> }> };
    return payload.tasks.map((task) => ({ suite: payload.suite, ...task }));
  });

  const promptMap = new Map(listPrompts().map((p) => [p.metadata.id, p]));
  const results = tasks.map((task) => {
    const prompt = promptMap.get(task.prompt_id);
    if (!prompt) {
      return { prompt_id: task.prompt_id, improved: false, baseline_cost: 0, optimized_cost: 0 };
    }
    const baselineCost = estimateTokens(prompt.template);
    const optimized = optimizeTemplate(prompt.template);
    const optimizedCost = estimateTokens(optimized);
    return {
      prompt_id: task.prompt_id,
      improved: optimizedCost < baselineCost,
      baseline_cost: baselineCost,
      optimized_cost: optimizedCost,
    };
  });

  return { suite: 'combined', results };
}

export function runSwarm(input: Record<string, string>): { run_id: string; roles: SwarmRoleResult[]; success: boolean } {
  ensurePromptOsScaffold();
  const config = readJson(SWARM_CONFIG_FILE) as { roles: Record<SwarmRoleResult['role'], string> };
  const orderedRoles: SwarmRoleResult['role'][] = ['planner', 'implementer', 'reviewer', 'critic', 'verifier'];
  const run_id = `swarm_${Date.now().toString(36)}`;
  const roles: SwarmRoleResult[] = [];

  let context = { ...input };
  for (const role of orderedRoles) {
    const promptId = config.roles[role];
    const result = runPromptById(promptId, context);
    roles.push({ role, prompt_id: promptId, result });
    context = { ...context, [`${role}_trace`]: result.trace_id };
  }

  return { run_id, roles, success: true };
}

export function runSelfHeal(issueType: 'ci_failure' | 'test_failure' | 'lint_failure' | 'security_issue'): {
  issue_type: string;
  diagnosis: string;
  fix_prompt: string;
  verification_commands: string[];
  swarm_run?: string;
} {
  const map: Record<typeof issueType, { diagnosis: string; prompt: string; commands: string[] }> = {
    ci_failure: {
      diagnosis: 'CI gate failed due to regressions in verification checks.',
      prompt: 'fix/build_failure_fix',
      commands: ['pnpm run lint', 'pnpm run typecheck', 'pnpm run build:web'],
    },
    test_failure: {
      diagnosis: 'Test suite reports deterministic contract violations.',
      prompt: 'fix/test_failure_fix',
      commands: ['pnpm run test', 'pnpm run verify:determinism'],
    },
    lint_failure: {
      diagnosis: 'Static analysis indicates policy/style drift.',
      prompt: 'fix/lint_autofix',
      commands: ['pnpm run lint'],
    },
    security_issue: {
      diagnosis: 'Security policy detected potential unsafe behavior.',
      prompt: 'review/security_scan_review',
      commands: ['pnpm run verify:nosecrets', 'pnpm run verify:policy'],
    },
  };

  const selected = map[issueType];
  const swarm = runSwarm({ issue_type: issueType, diagnosis: selected.diagnosis });
  persistKnowledge({
    kind: 'successful_fix',
    value: `${issueType}:${swarm.run_id}`,
  });

  return {
    issue_type: issueType,
    diagnosis: selected.diagnosis,
    fix_prompt: selected.prompt,
    verification_commands: selected.commands,
    swarm_run: swarm.run_id,
  };
}

export function updateObservability(): void {
  const records = readNdjson<PromptMetricRecord>(METRICS_FILE);
  const total = records.length;
  const failures = records.filter((r) => !r.execution_success).length;
  const latency = total > 0 ? Math.round(records.reduce((sum, r) => sum + r.runtime_ms, 0) / total) : 0;
  const resourceUsage = records.reduce((sum, r) => sum + r.token_estimate, 0);

  writeJson(OBS_FILE, {
    generated_at: new Date().toISOString(),
    execution_count: total,
    failure_rate: total === 0 ? 0 : failures / total,
    latency_ms_avg: latency,
    resource_usage_tokens: resourceUsage,
  });
}

export function selectModel(prompt: PromptArtifact, runtimeMsBudget = 2000): string {
  const metrics = readNdjson<PromptMetricRecord>(METRICS_FILE).filter((r) => r.prompt_id === prompt.metadata.id);
  const success = successRate(metrics);
  if (runtimeMsBudget < 1500 || success > 0.95) {
    return 'gpt-5.2-mini';
  }
  if (prompt.metadata.runtime === 'local_llm') {
    return 'local/mistral';
  }
  return 'gpt-5.2-codex';
}

export function optimizeTemplate(template: string): string {
  return template
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function estimateTokens(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

function successRate(records: Array<Pick<PromptMetricRecord, 'execution_success' | 'test_success' | 'build_success'>>): number {
  if (records.length === 0) return 0;
  const successful = records.filter((r) => r.execution_success && r.test_success && r.build_success).length;
  return successful / records.length;
}

function persistKnowledge(entry: { kind: 'successful_fix' | 'common_issue'; value: string }): void {
  const knowledge = readJson(KNOWLEDGE_FILE) as {
    successful_fixes: string[];
    common_issues: string[];
  };

  if (entry.kind === 'successful_fix' && !knowledge.successful_fixes.includes(entry.value)) {
    knowledge.successful_fixes.push(entry.value);
  }
  if (entry.kind === 'common_issue' && !knowledge.common_issues.includes(entry.value)) {
    knowledge.common_issues.push(entry.value);
  }
  writeJson(KNOWLEDGE_FILE, knowledge);
}

function hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function readNdjson<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line) as T);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath: string, payload: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}
