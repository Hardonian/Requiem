/**
 * rl prompt command - List/get/add/run prompts with deterministic hash IDs
 */

/* eslint-disable no-restricted-imports */
import fs from 'fs';
import path from 'path';
import { PromptRepository, Prompt } from '../db/operator-console.js';
import { hashContent, shortHash, normalizeTimestamp } from '../lib/deterministic.js';

interface PromptListResult {
  prompts: Array<{
    id: string;
    name: string;
    version: string;
    description?: string;
    tags: string[];
    variables: string[];
    usage_count: number;
    updated_at: string;
  }>;
}

export async function runPrompt(
  subcommand: string,
  args: string[],
  options: { json: boolean }
): Promise<number> {
  const repo = new PromptRepository();

  switch (subcommand) {
    case 'list':
      return runList(repo, args, options);
    case 'get':
      return runGet(repo, args[0], args.includes('--version') ? args[args.indexOf('--version') + 1] : undefined, options);
    case 'add':
      return runAdd(repo, args[0], args[1], options);
    case 'run':
      return runExecute(repo, args[0], args.slice(1), options);
    case 'delete':
      return runDelete(repo, args[0], options);
    default:
      console.error(`Unknown prompt subcommand: ${subcommand}`);
      console.error('Usage: rl prompt list|get|add|run|delete');
      return 1;
  }
}

async function runList(
  repo: PromptRepository,
  args: string[],
  options: { json: boolean }
): Promise<number> {
  const tagIndex = args.indexOf('--tag');
  const tag = tagIndex >= 0 ? args[tagIndex + 1] : undefined;

  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : undefined;

  const prompts = repo.list({ tag, limit });

  if (options.json) {
    const result: PromptListResult = { prompts };
    console.log(JSON.stringify(result, null, 2));
  } else {
    printPromptList(prompts);
  }

  return 0;
}

async function runGet(
  repo: PromptRepository,
  name: string,
  version: string | undefined,
  options: { json: boolean }
): Promise<number> {
  if (!name) {
    console.error('Usage: rl prompt get <name> [--version <version>]');
    return 1;
  }

  const prompt = repo.findByName(name, version);

  if (!prompt) {
    console.error(`Prompt not found: ${name}${version ? ` v${version}` : ''}`);
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify({ prompt }, null, 2));
  } else {
    printPrompt(prompt);
  }

  return 0;
}

async function runAdd(
  repo: PromptRepository,
  name: string,
  filePath: string,
  options: { json: boolean }
): Promise<number> {
  if (!name || !filePath) {
    console.error('Usage: rl prompt add <name> <file>');
    return 1;
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return 1;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract variables from content ({{variable}} pattern)
  const variableMatches = content.match(/\{\{(\w+)\}\}/g) || [];
  const variables = Array.from(new Set(variableMatches.map(v => v.slice(2, -2))));

  // Check for existing prompt
  const existing = repo.findByName(name);
  const version = existing
    ? incrementVersion(existing.version)
    : '1.0.0';

  // Generate deterministic ID from content
  const id = hashContent(`${name}:${version}:${content}`);

  const prompt: Omit<Prompt, 'usage_count'> = {
    id,
    name,
    version,
    content,
    description: `Added from ${path.basename(filePath)}`,
    tags: [],
    variables,
    created_at: normalizeTimestamp(new Date()),
    updated_at: normalizeTimestamp(new Date()),
  };

  const created = repo.create(prompt);

  if (options.json) {
    console.log(JSON.stringify({ prompt: created }, null, 2));
  } else {
    console.log(`Prompt added: ${created.name} v${created.version}`);
    console.log(`ID: ${shortHash(created.id)}`);
    console.log(`Variables: ${variables.length > 0 ? variables.join(', ') : 'none'}`);
  }

  return 0;
}

async function runExecute(
  repo: PromptRepository,
  name: string,
  varArgs: string[],
  options: { json: boolean }
): Promise<number> {
  if (!name) {
    console.error('Usage: rl prompt run <name> [var=value ...]');
    return 1;
  }

  const prompt = repo.findByName(name);

  if (!prompt) {
    console.error(`Prompt not found: ${name}`);
    return 1;
  }

  // Parse variable assignments
  const variables: Record<string, string> = {};
  for (const arg of varArgs) {
    const [key, ...valueParts] = arg.split('=');
    if (key && valueParts.length > 0) {
      variables[key] = valueParts.join('=');
    }
  }

  // Substitute variables
  let rendered = prompt.content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Check for unsubstituted variables
  const unsubstituted = rendered.match(/\{\{(\w+)\}\}/g) || [];

  // Increment usage count
  repo.incrementUsage(prompt.id);

  if (options.json) {
    console.log(JSON.stringify({
      prompt: {
        id: prompt.id,
        name: prompt.name,
        version: prompt.version,
      },
      rendered,
      variables,
      warnings: unsubstituted.length > 0 ? [`Unsubstituted variables: ${unsubstituted.join(', ')}`] : [],
    }, null, 2));
  } else {
    console.log('');
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log(`│ ${prompt.name} v${prompt.version}`.padEnd(59) + '│');
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log(rendered.split('\n').map(l => `│ ${l.substring(0, 58).padEnd(58)}│`).join('\n'));
    console.log('└────────────────────────────────────────────────────────────┘');

    if (unsubstituted.length > 0) {
      console.log('');
      console.log(`Warning: Unsubstituted variables: ${unsubstituted.join(', ')}`);
    }
  }

  return 0;
}

async function runDelete(
  repo: PromptRepository,
  id: string,
  options: { json: boolean }
): Promise<number> {
  if (!id) {
    console.error('Usage: rl prompt delete <id>');
    return 1;
  }

  const success = repo.delete(id);

  if (!success) {
    console.error(`Prompt not found: ${id}`);
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify({ deleted: id }, null, 2));
  } else {
    console.log(`Prompt deleted: ${shortHash(id)}`);
  }

  return 0;
}

function printPromptList(prompts: Prompt[]): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Prompt Packs                                               │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  Hash      Name            Version  Variables  Used       │');
  console.log('├────────────────────────────────────────────────────────────┤');

  for (const p of prompts) {
    const hash = shortHash(p.id).padEnd(8);
    const name = p.name.substring(0, 14).padEnd(14);
    const version = p.version.padEnd(7);
    const vars = String(p.variables.length).padEnd(9);
    const used = String(p.usage_count).padEnd(5);
    console.log(`│ ${hash} ${name} ${version} ${vars} ${used} │`);
  }

  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Total: ${String(prompts.length).padEnd(48)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

function printPrompt(prompt: Prompt): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log(`│ ${prompt.name} v${prompt.version}`.padEnd(59) + '│');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  ID:          ${shortHash(prompt.id).padEnd(44)}│`);
  console.log(`│  Variables:   ${(prompt.variables.join(', ') || 'none').padEnd(44)}│`);
  console.log(`│  Tags:        ${(prompt.tags.join(', ') || 'none').padEnd(44)}│`);
  console.log(`│  Usage:       ${String(prompt.usage_count).padEnd(44)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(prompt.content.split('\n').map(l => `│ ${l.substring(0, 58).padEnd(58)}│`).join('\n'));
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

export default runPrompt;
