/**
 * AI CLI Module
 *
 * Commands for managing AI tools, skills, and telemetry:
 * - requiem ai tools list
 * - requiem ai skills list
 * - requiem ai skills run <name>
 * - requiem ai telemetry
 */

import { listTools as listAiTools, setPolicyGate } from '../lib/ai-tools.js';
import { listSkills, getSkill } from '../lib/ai-skills.js';
import { getTelemetrySummary } from '../lib/ai-telemetry.js';

export interface AiCliArgs {
  command: 'tools' | 'skills' | 'telemetry';
  subCommand?: string;
  skillName?: string;
  toolName?: string;
  json?: boolean;
  tenantId?: string;
}

export function parseAiArgs(argv: string[]): AiCliArgs {
  const result: AiCliArgs = {
    command: 'tools', // default
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === 'tools') {
      result.command = 'tools';
    } else if (arg === 'skills') {
      result.command = 'skills';
    } else if (arg === 'telemetry') {
      result.command = 'telemetry';
    } else if (arg === 'list') {
      result.subCommand = 'list';
    } else if (arg === 'run') {
      result.subCommand = 'run';
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--tenant' && next) {
      result.tenantId = next;
      i++;
    } else if (result.subCommand === 'run' && arg) {
      // This is the skill name
      result.skillName = arg;
    }
  }

  return result;
}

export async function runAiCommand(args: AiCliArgs): Promise<number> {
  try {
    // Setup a permissive policy gate for CLI usage
    setPolicyGate(async () => ({ allowed: true, reason: 'CLI usage' }));

    switch (args.command) {
      case 'tools':
        return await handleToolsCommand(args);
      case 'skills':
        return await handleSkillsCommand(args);
      case 'telemetry':
        return await handleTelemetryCommand(args);
      default:
        console.error(`Unknown command: ${args.command}`);
        return 1;
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return 1;
  }
}

async function handleToolsCommand(args: AiCliArgs): Promise<number> {
  const tenantId = args.tenantId || 'system';

  if (args.subCommand === 'list' || !args.subCommand) {
    const tools = listAiTools(tenantId);

    if (args.json) {
      console.log(JSON.stringify(tools, null, 2));
    } else {
      console.log(`\n=== Registered AI Tools (${tools.length}) ===\n`);
      
      if (tools.length === 0) {
        console.log('No tools registered.');
      } else {
        for (const tool of tools) {
          console.log(`  ${tool.name}@${tool.version}`);
          console.log(`    ${tool.description}`);
          console.log(`    Deterministic: ${tool.deterministic}, SideEffect: ${tool.sideEffect}, Idempotent: ${tool.idempotent}`);
          console.log(`    Capabilities: ${tool.requiredCapabilities.join(', ') || 'none'}`);
          console.log('');
        }
      }
    }
    return 0;
  }

  console.error(`Unknown tools subcommand: ${args.subCommand}`);
  return 1;
}

async function handleSkillsCommand(args: AiCliArgs): Promise<number> {
  if (args.subCommand === 'list' || !args.subCommand) {
    const skills = listSkills();

    if (args.json) {
      console.log(JSON.stringify(skills, null, 2));
    } else {
      console.log(`\n=== Registered AI Skills (${skills.length}) ===\n`);
      
      if (skills.length === 0) {
        console.log('No skills registered.');
      } else {
        for (const skill of skills) {
          console.log(`  ${skill.name}@${skill.version}`);
          console.log(`    ${skill.description}`);
          console.log(`    Steps: ${skill.steps.length}`);
          console.log('');
        }
      }
    }
    return 0;
  }

  if (args.subCommand === 'run') {
    if (!args.skillName) {
      console.error('Error: Skill name required for run command');
      console.error('Usage: requiem ai skills run <skill-name> [--tenant <id>]');
      return 1;
    }

    const skill = getSkill(args.skillName);
    if (!skill) {
      console.error(`Error: Skill "${args.skillName}" not found`);
      console.error('Use "requiem ai skills list" to see available skills');
      return 1;
    }

    // Create mock invocation context for CLI
    // Note: Context creation is prepared for future skill execution
    // const context = { ... }

    console.log(`\n=== Running Skill: ${skill.name}@${skill.version} ===\n`);
    console.log('Note: Skill execution requires full policy gate setup. Use MCP server for production.');
    console.log(`Skill has ${skill.steps.length} steps defined.`);

    if (args.json) {
      console.log(JSON.stringify({
        skill: skill.name,
        version: skill.version,
        steps: skill.steps.length,
        note: 'Execution requires full policy gate setup'
      }, null, 2));
    }

    return 0;
  }

  console.error(`Unknown skills subcommand: ${args.subCommand}`);
  return 1;
}

async function handleTelemetryCommand(args: AiCliArgs): Promise<number> {
  const tenantId = args.tenantId || 'system';

  const summary = getTelemetrySummary(tenantId);

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n=== AI Telemetry Summary ===\n`);
    console.log(`  Total Requests: ${summary.totalRequests}`);
    console.log(`  Total Cost (cents): ${summary.totalCostCents}`);
    console.log(`  Average Latency (ms): ${summary.avgLatencyMs}`);
    console.log(`  Error Rate: ${summary.errorRate * 100}%`);
    console.log('');
  }

  return 0;
}

