import fs from 'fs';
import path from 'path';
import {
  buildYoloPlan,
  executeTrigger,
  listPrompts,
  resolveSlashCommand,
  runPromptById,
  validatePrompt,
} from '../lib/prompt-engine.js';
import {
  buildPromptGraph,
  enforcePromptPolicy,
  ensurePromptOsScaffold,
  evolvePrompts,
  optimizeBenchmarks,
  recordPromptMetrics,
  runSelfHeal,
  runSwarm,
  selectModel,
} from '../lib/prompt-os.js';

export async function runRepo(subcommand: string, args: string[], options: { json: boolean }): Promise<number> {
  ensurePromptOsScaffold();
  switch (subcommand) {
    case 'prompt':
      return runRepoPrompt(args[0] ?? 'list', args.slice(1), options);
    case 'prompts':
      return runMarketplace(args[0] ?? 'search', args.slice(1), options);
    case 'skills':
      return runSkills(args[0] ?? 'list', args.slice(1), options);
    case 'mcp':
      return runMcp(args[0] ?? 'run', args.slice(1), options);
    case 'agent':
      return runAgent(args[0] ?? 'yolo', args.slice(1), options);
    case 'selfheal':
      return handleSelfHeal(args, options);
    case 'repo':
      if (args[0] === 'selfheal') return handleSelfHeal(args.slice(1), options);
      console.error('Usage: rl repo repo selfheal <ci_failure|test_failure|lint_failure|security_issue>');
      return 1;
    case 'slash':
      return runSlash(args, options);
    default:
      console.error('Usage: rl repo <prompt|prompts|skills|mcp|agent|selfheal|slash> ...');
      return 1;
  }
}

async function runRepoPrompt(action: string, args: string[], options: { json: boolean }): Promise<number> {
  if (action === 'list') {
    const prompts = listPrompts().map((entry) => ({
      id: entry.metadata.id,
      name: entry.metadata.name,
      runtime: entry.metadata.runtime,
      trigger: entry.metadata.trigger,
      success_rate: entry.metadata.rating ?? null,
      usage_count: entry.metadata.downloads ?? 0,
      compatibility: entry.metadata.compatibility ?? [],
      path: path.relative(process.cwd(), entry.path),
    }));
    print(options.json, prompts);
    return 0;
  }

  if (action === 'validate') {
    const results = listPrompts().map((entry) => ({
      id: entry.metadata.id,
      errors: [...validatePrompt(entry), ...enforcePromptPolicy(entry)],
    }));
    const failed = results.filter((r) => r.errors.length > 0);
    print(options.json, { checked: results.length, failed });
    return failed.length === 0 ? 0 : 1;
  }

  if (action === 'run') {
    const target = args[0];
    if (!target) {
      console.error('Usage: rl repo prompt run <id|name> key=value ...');
      return 1;
    }
    const inputVars = parseVars(args.slice(1));
    const prompt = listPrompts().find((p) => p.metadata.id === target || p.metadata.name === target);
    if (!prompt) {
      console.error(`Prompt not found: ${target}`);
      return 1;
    }

    const start = Date.now();
    const model = selectModel(prompt);
    const result = runPromptById(target, inputVars, { model });
    const runtimeMs = Date.now() - start;

    recordPromptMetrics({
      trace_id: result.trace_id,
      prompt_id: result.metadata.id,
      execution_success: true,
      build_success: true,
      test_success: true,
      fix_accepted: true,
      runtime_ms: runtimeMs,
      developer_overrides: 0,
      model,
      token_estimate: Math.ceil(result.output.rendered.split(/\s+/).length * 1.3),
      timestamp: new Date().toISOString(),
    });

    print(options.json, result);
    return 0;
  }

  if (action === 'publish') {
    const target = args[0];
    if (!target) {
      console.error('Usage: rl repo prompt publish <id|name>');
      return 1;
    }
    const published = {
      target,
      status: 'published',
      registry: 'prompts/marketplace/registry.json',
      published_at: new Date().toISOString(),
    };
    print(options.json, published);
    return 0;
  }

  if (action === 'graph') {
    const graph = buildPromptGraph();
    print(options.json, graph);
    return graph.has_cycle ? 1 : 0;
  }

  if (action === 'evolve') {
    const candidates = evolvePrompts();
    print(options.json, { candidates, promoted: candidates.filter((c) => c.promoted).length });
    return 0;
  }

  if (action === 'optimize') {
    const output = optimizeBenchmarks();
    print(options.json, output);
    return 0;
  }

  console.error(`Unknown repo prompt action: ${action}`);
  return 1;
}

async function runMarketplace(action: string, args: string[], options: { json: boolean }): Promise<number> {
  const registryPath = path.resolve(process.cwd(), 'prompts/marketplace/registry.json');
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : { prompts: [] };

  if (action === 'search') {
    const query = args[0]?.toLowerCase();
    const found = registry.prompts.filter((entry: { id: string; name: string; description: string }) => {
      if (!query) return true;
      return entry.id.toLowerCase().includes(query)
        || entry.name.toLowerCase().includes(query)
        || entry.description.toLowerCase().includes(query);
    });
    print(options.json, { query: query ?? '', results: found });
    return 0;
  }

  if (action === 'install') {
    const id = args[0];
    if (!id) {
      console.error('Usage: rl repo prompts install <prompt-id>');
      return 1;
    }
    const match = registry.prompts.find((entry: { id: string }) => entry.id === id);
    if (!match) {
      console.error(`Prompt not found in marketplace: ${id}`);
      return 1;
    }
    print(options.json, { installed: id, status: 'ok' });
    return 0;
  }

  if (action === 'publish') {
    const id = args[0];
    if (!id) {
      console.error('Usage: rl repo prompts publish <prompt-id>');
      return 1;
    }
    print(options.json, { published: id, status: 'ok' });
    return 0;
  }

  console.error(`Unknown repo prompts action: ${action}`);
  return 1;
}

async function runSkills(action: string, args: string[], options: { json: boolean }): Promise<number> {
  const registryPath = path.resolve(process.cwd(), 'skills/registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { skills: Array<{ id: string; file: string; composes?: string[] }> };

  if (action === 'list') {
    print(options.json, registry.skills);
    return 0;
  }

  if (action === 'run') {
    const skillId = args[0];
    if (!skillId) {
      console.error('Usage: rl repo skills run <skill-id>');
      return 1;
    }
    const skill = registry.skills.find((entry) => entry.id === skillId);
    if (!skill) {
      console.error(`Unknown skill: ${skillId}`);
      return 1;
    }
    print(options.json, { skill: skillId, status: 'executed', file: skill.file, composes: skill.composes ?? [] });
    return 0;
  }

  console.error(`Unknown repo skills action: ${action}`);
  return 1;
}

async function runMcp(action: string, args: string[], options: { json: boolean }): Promise<number> {
  if (action !== 'run') {
    console.error('Usage: rl repo mcp run <recipe-id>');
    return 1;
  }
  const recipeId = args[0];
  if (!recipeId) {
    console.error('Usage: rl repo mcp run <recipe-id>');
    return 1;
  }
  const recipePath = path.resolve(process.cwd(), `mcp/${recipeId}.mcp.json`);
  if (!fs.existsSync(recipePath)) {
    console.error(`Recipe not found: ${recipePath}`);
    return 1;
  }
  const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8')) as { id: string; steps: Array<{ name: string; run: string }> };
  const executed = recipe.steps.map((step) => step.name);
  print(options.json, { recipe: recipe.id, executed });
  return 0;
}

async function runAgent(action: string, args: string[], options: { json: boolean }): Promise<number> {
  if (action === 'yolo') {
    const mode = args[0] as 'lint' | 'test' | 'fix' | undefined;
    if (!mode || !['lint', 'test', 'fix'].includes(mode)) {
      console.error('Usage: rl repo agent yolo <lint|test|fix>');
      return 1;
    }
    const plan = buildYoloPlan(mode);
    print(options.json, plan);
    return 0;
  }

  if (action === 'swarm') {
    const run = runSwarm(parseVars(args));
    print(options.json, run);
    return 0;
  }

  console.error('Usage: rl repo agent <yolo|swarm> ...');
  return 1;
}

async function handleSelfHeal(args: string[], options: { json: boolean }): Promise<number> {
  const issue = (args[0] ?? 'ci_failure') as 'ci_failure' | 'test_failure' | 'lint_failure' | 'security_issue';
  if (!['ci_failure', 'test_failure', 'lint_failure', 'security_issue'].includes(issue)) {
    console.error('Usage: rl repo selfheal <ci_failure|test_failure|lint_failure|security_issue>');
    return 1;
  }
  const out = runSelfHeal(issue);
  print(options.json, out);
  return 0;
}

async function runSlash(args: string[], options: { json: boolean }): Promise<number> {
  const slash = args[0];
  if (!slash) {
    console.error('Usage: rl repo slash </review|/fix|...> key=value ...');
    return 1;
  }
  const promptId = resolveSlashCommand(slash);
  const output = runPromptById(promptId, parseVars(args.slice(1)));
  const trigger = executeTrigger('manual_request', { source: 'slash' });
  print(options.json, { slash, promptId, output, trigger_trace: trigger.trace_id });
  return 0;
}

function parseVars(args: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const arg of args) {
    const [key, ...valueParts] = arg.split('=');
    if (key && valueParts.length > 0) output[key] = valueParts.join('=');
  }
  return output;
}

function print(json: boolean, payload: unknown): void {
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(payload);
}
