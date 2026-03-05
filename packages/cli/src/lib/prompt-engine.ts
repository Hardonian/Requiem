import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type PromptRuntime = 'codex' | 'local_llm' | 'openrouter' | 'anthropic' | 'gemini';
export type PromptTrigger =
  | 'commit'
  | 'pull_request'
  | 'merge'
  | 'build_fail'
  | 'lint_fail'
  | 'test_fail'
  | 'security_scan'
  | 'manual_request';

export interface PromptMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  runtime: PromptRuntime;
  permissions: string[];
  trigger: PromptTrigger[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  safety_level: 'low' | 'medium' | 'high';
  reproducibility_seed: number;
  rating?: number;
  downloads?: number;
  compatibility?: string[];
  runtime_requirements?: string[];
}

export interface PromptArtifact {
  metadata: PromptMetadata;
  template: string;
  path: string;
}

export interface PromptExecutionResult {
  trace_id: string;
  metadata: PromptMetadata;
  runtime: PromptRuntime;
  inputs: Record<string, string>;
  output: {
    rendered: string;
    model: string;
    temperature: number;
    deterministic_seed: number;
  };
  log_path: string;
  artifact_path: string;
  audit_path: string;
}

const PROMPT_ROOT = path.resolve(process.cwd(), 'prompts');
const LOG_ROOT = path.resolve(process.cwd(), 'logs/prompts');

export const TRIGGER_TO_PROMPT: Record<string, string> = {
  pull_request: 'review/full_repo_review',
  test_fail: 'fix/test_failure_fix',
  lint_fail: 'fix/lint_autofix',
  commit: 'review/commit_review',
  merge: 'review/merge_gate_review',
  build_fail: 'fix/build_failure_fix',
  security_scan: 'review/security_scan_review',
  manual_request: 'review/module_review',
};

export function listPrompts(): PromptArtifact[] {
  const files = walk(PROMPT_ROOT).filter((f) => f.endsWith('.prompt.json'));
  return files.map(loadPromptFile);
}

export function validatePrompt(artifact: PromptArtifact): string[] {
  const errors: string[] = [];
  const required = [
    'id', 'name', 'description', 'author', 'version', 'runtime', 'permissions', 'trigger',
    'inputs', 'outputs', 'safety_level', 'reproducibility_seed',
  ] as const;

  for (const key of required) {
    if ((artifact.metadata as unknown as Record<string, unknown>)[key] === undefined) {
      errors.push(`missing metadata.${key}`);
    }
  }
  if (!Array.isArray(artifact.metadata.permissions) || artifact.metadata.permissions.length === 0) {
    errors.push('metadata.permissions must be a non-empty array');
  }
  if (!Array.isArray(artifact.metadata.trigger) || artifact.metadata.trigger.length === 0) {
    errors.push('metadata.trigger must be a non-empty array');
  }
  if (artifact.template.trim().length === 0) {
    errors.push('template must be non-empty');
  }
  return errors;
}

export function runPromptById(
  idOrName: string,
  inputs: Record<string, string>,
  options?: { allowedPermissions?: string[]; temperature?: number; model?: string }
): PromptExecutionResult {
  const prompt = listPrompts().find((p) => p.metadata.id === idOrName || p.metadata.name === idOrName);
  if (!prompt) {
    throw new Error(`Prompt not found: ${idOrName}`);
  }

  const allowed = new Set(options?.allowedPermissions ?? ['read_repo', 'run_tests', 'write_repo']);
  const missingPermissions = prompt.metadata.permissions.filter((permission) => !allowed.has(permission));
  if (missingPermissions.length > 0) {
    throw new Error(`Permission denied: ${missingPermissions.join(', ')}`);
  }

  const trace_id = createTraceId(prompt.metadata.id, inputs);
  const deterministic_seed = prompt.metadata.reproducibility_seed;
  const rendered = renderTemplate(prompt.template, inputs);

  fs.mkdirSync(path.join(LOG_ROOT, 'artifacts'), { recursive: true });

  const executionLog = {
    trace_id,
    prompt_id: prompt.metadata.id,
    runtime: prompt.metadata.runtime,
    permissions: prompt.metadata.permissions,
    trigger: prompt.metadata.trigger,
    inputs,
    timestamp: new Date().toISOString(),
  };

  const output = {
    rendered,
    model: options?.model ?? defaultModelForRuntime(prompt.metadata.runtime),
    temperature: options?.temperature ?? 0,
    deterministic_seed,
  };

  const artifact_path = path.join(LOG_ROOT, 'artifacts', `${trace_id}.json`);
  const log_path = path.join(LOG_ROOT, `${trace_id}.log.json`);
  const audit_path = path.join(LOG_ROOT, 'audit.ndjson');

  fs.writeFileSync(artifact_path, JSON.stringify({ output }, null, 2));
  fs.writeFileSync(log_path, JSON.stringify({ ...executionLog, output }, null, 2));
  fs.appendFileSync(audit_path, JSON.stringify({
    trace_id,
    prompt_id: prompt.metadata.id,
    artifact_path,
    log_path,
    modified_code: false,
    timestamp: executionLog.timestamp,
  }) + '\n');

  return {
    trace_id,
    metadata: prompt.metadata,
    runtime: prompt.metadata.runtime,
    inputs,
    output,
    log_path,
    artifact_path,
    audit_path,
  };
}

export function executeTrigger(trigger: PromptTrigger, inputs: Record<string, string>): PromptExecutionResult {
  const mapping = TRIGGER_TO_PROMPT[trigger];
  if (!mapping) {
    throw new Error(`No prompt mapped for trigger: ${trigger}`);
  }
  return runPromptById(mapping, inputs);
}

export function resolveSlashCommand(command: string): string {
  const cleaned = command.trim().toLowerCase();
  const map: Record<string, string> = {
    '/review': 'review/module_review',
    '/fix': 'fix/lint_autofix',
    '/refactor': 'review/module_review',
    '/explain': 'system/explain_change',
    '/test': 'fix/test_failure_fix',
    '/generate': 'skills/test_generator_skill',
    '/document': 'skills/doc_writer_skill',
    '/optimize': 'skills/performance_optimizer_skill',
    '/benchmark': 'skills/performance_optimizer_skill',
    '/security': 'review/security_scan_review',
  };
  const resolved = map[cleaned];
  if (!resolved) {
    throw new Error(`Unsupported slash command: ${command}`);
  }
  return resolved;
}

export interface YoloRunResult {
  mode: 'lint' | 'test' | 'fix';
  executed_commands: string[];
  auto_commit_message?: string;
  guardrails: string[];
}

export function buildYoloPlan(mode: 'lint' | 'test' | 'fix'): YoloRunResult {
  const commandsByMode: Record<'lint' | 'test' | 'fix', string[]> = {
    lint: ['pnpm lint'],
    test: ['pnpm test'],
    fix: ['pnpm lint', 'pnpm test', 'git add -A', 'git commit -m "[agent-fix] lint corrections via prompt"'],
  };
  return {
    mode,
    executed_commands: commandsByMode[mode],
    auto_commit_message: mode === 'fix' ? '[agent-fix] lint corrections via prompt' : undefined,
    guardrails: [
      'operate inside repository only',
      'do not touch protected files',
      'do not modify secrets',
      'do not push to protected branches',
      'commit only if lint and tests pass',
    ],
  };
}

function loadPromptFile(filePath: string): PromptArtifact {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { metadata: PromptMetadata; template: string };
  return {
    metadata: raw.metadata,
    template: raw.template,
    path: filePath,
  };
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function renderTemplate(template: string, inputs: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => inputs[key] ?? `{{${key}}}`);
}

function createTraceId(promptId: string, inputs: Record<string, string>): string {
  const source = `${promptId}:${JSON.stringify(inputs)}`;
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
}

function defaultModelForRuntime(runtime: PromptRuntime): string {
  const models: Record<PromptRuntime, string> = {
    codex: 'gpt-5.2-codex',
    local_llm: 'local/mistral',
    openrouter: 'openrouter/auto',
    anthropic: 'claude-3-7-sonnet',
    gemini: 'gemini-2.0-flash',
  };
  return models[runtime];
}
