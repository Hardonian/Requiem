/**
 * Junctions CLI Module
 * 
 * Commands:
 * - requiem junctions scan --since <time> --json
 * - requiem junctions list
 * - requiem junctions show <id>
 */

import { junctionOrchestrator } from '../junctions/orchestrator.js';
import type { Junction } from '../db/junctions.js';
import { JUNCTION_TYPE_META, getSeverityLevel } from '../junctions/types.js';

export interface JunctionsCliArgs {
  command: 'scan' | 'list' | 'show';
  since?: string;
  json?: boolean;
  junctionType?: string;
  minSeverity?: number;
  limit?: number;
  id?: string;
}

export function parseJunctionsArgs(argv: string[]): JunctionsCliArgs {
  const result: JunctionsCliArgs = {
    command: 'list',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === 'scan') {
      result.command = 'scan';
    } else if (arg === 'list') {
      result.command = 'list';
    } else if (arg === 'show') {
      result.command = 'show';
      if (next && !next.startsWith('--')) {
        result.id = next;
        i++;
      }
    } else if (arg === '--since' && next) {
      result.since = next;
      i++;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--type' && next) {
      result.junctionType = next;
      i++;
    } else if (arg === '--min-severity' && next) {
      result.minSeverity = parseFloat(next);
      i++;
    } else if (arg === '--limit' && next) {
      result.limit = parseInt(next, 10);
      i++;
    }
  }

  return result;
}

/**
 * Parse time string like "7d", "24h", "30m" into a Date
 */
function parseTimeString(timeStr: string): Date {
  const now = new Date();
  const match = timeStr.match(/^(\d+)([dhms])$/);
  
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Use format like "7d", "24h", "30m"`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'h':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'm':
      return new Date(now.getTime() - value * 60 * 1000);
    case 's':
      return new Date(now.getTime() - value * 1000);
    default:
      return new Date(now.getTime() - value * 60 * 60 * 1000);
  }
}

/**
 * Format a junction for output
 */
function formatJunction(junction: Junction, verbose: boolean = false): any {
  const meta = JUNCTION_TYPE_META[junction.junction_type as keyof typeof JUNCTION_TYPE_META];
  const severityLevel = getSeverityLevel(junction.severity_score);
  
  const output: any = {
    id: junction.id,
    type: junction.junction_type,
    typeLabel: meta?.label || junction.junction_type,
    severityScore: junction.severity_score,
    severityLevel,
    status: junction.status,
    sourceType: junction.source_type,
    sourceRef: junction.source_ref,
    fingerprint: junction.fingerprint,
    createdAt: junction.created_at,
  };
  
  if (verbose) {
    output.triggerData = JSON.parse(junction.trigger_data);
    output.triggerTrace = JSON.parse(junction.trigger_trace);
    output.cooldownUntil = junction.cooldown_until;
    output.deduplicationKey = junction.deduplication_key;
    output.decisionReportId = junction.decision_report_id;
    output.updatedAt = junction.updated_at;
  }
  
  return output;
}

/**
 * Run the junctions CLI command
 */
export async function runJunctionsCommand(args: JunctionsCliArgs): Promise<number> {
  try {
    switch (args.command) {
      case 'scan':
        return await handleScan(args);
      case 'list':
        return await handleList(args);
      case 'show':
        return await handleShow(args);
      default:
        console.error(`Unknown command: ${args.command}`);
        return 1;
    }
  } catch (error) {
    if (args.json) {
      console.error(JSON.stringify({
        error: (error as Error).message,
        code: 'E_INTERNAL',
      }));
    } else {
      console.error(`Error: ${(error as Error).message}`);
    }
    return 1;
  }
}

async function handleScan(args: JunctionsCliArgs): Promise<number> {
  if (!args.since) {
    console.error('Error: --since is required for scan command');
    return 1;
  }
  
  const since = parseTimeString(args.since);
  const junctions = await junctionOrchestrator.scan(since, {
    junctionType: args.junctionType,
    minSeverity: args.minSeverity,
    limit: args.limit,
  });
  
  if (args.json) {
    console.log(JSON.stringify({
      command: 'scan',
      since: args.since,
      count: junctions.length,
      junctions: junctions.map(j => formatJunction(j)),
    }, null, 2));
  } else {
    console.log(`\n=== Junctions Scan ===`);
    console.log(`Since: ${args.since}`);
    console.log(`Found: ${junctions.length} junction(s)\n`);
    
    for (const junction of junctions) {
      const output = formatJunction(junction);
      console.log(`[${output.severityLevel.toUpperCase()}] ${output.typeLabel}`);
      console.log(`  ID: ${output.id}`);
      console.log(`  Fingerprint: ${output.fingerprint}`);
      console.log(`  Source: ${output.sourceType}:${output.sourceRef}`);
      console.log(`  Status: ${output.status}`);
      console.log(`  Created: ${output.createdAt}`);
      console.log('');
    }
  }
  
  return 0;
}

async function handleList(args: JunctionsCliArgs): Promise<number> {
  const junctions = await junctionOrchestrator.listJunctions({
    junctionType: args.junctionType,
    minSeverity: args.minSeverity,
    limit: args.limit || 50,
  });
  
  if (args.json) {
    console.log(JSON.stringify({
      command: 'list',
      count: junctions.length,
      junctions: junctions.map(j => formatJunction(j)),
    }, null, 2));
  } else {
    console.log(`\n=== Junctions List ===`);
    console.log(`Total: ${junctions.length} junction(s)\n`);
    
    for (const junction of junctions) {
      const output = formatJunction(junction);
      console.log(`[${output.severityLevel.toUpperCase()}] ${output.typeLabel} - ${output.id}`);
      console.log(`  Status: ${output.status} | Source: ${output.sourceType}:${output.sourceRef}`);
      console.log(`  Fingerprint: ${output.fingerprint}`);
      console.log('');
    }
  }
  
  return 0;
}

async function handleShow(args: JunctionsCliArgs): Promise<number> {
  if (!args.id) {
    console.error('Error: Junction ID is required');
    return 1;
  }
  
  const junction = await junctionOrchestrator.getJunction(args.id);
  
  if (!junction) {
    if (args.json) {
      console.log(JSON.stringify({
        error: 'Junction not found',
        code: 'E_NOT_FOUND',
        id: args.id,
      }));
    } else {
      console.log(`Junction not found: ${args.id}`);
    }
    return 1;
  }
  
  const output = formatJunction(junction, true);
  
  if (args.json) {
    console.log(JSON.stringify({
      command: 'show',
      junction: output,
    }, null, 2));
  } else {
    console.log(`\n=== Junction Details ===\n`);
    console.log(`ID: ${output.id}`);
    console.log(`Type: ${output.typeLabel} (${output.type})`);
    console.log(`Severity: ${output.severityScore.toFixed(2)} (${output.severityLevel})`);
    console.log(`Status: ${output.status}`);
    console.log(`Source: ${output.sourceType}:${output.sourceRef}`);
    console.log(`Fingerprint: ${output.fingerprint}`);
    console.log(`Created: ${output.createdAt}`);
    console.log(`Updated: ${output.updatedAt}`);
    
    if (output.cooldownUntil) {
      console.log(`Cooldown Until: ${output.cooldownUntil}`);
    }
    
    console.log('\n--- Trigger Data ---');
    console.log(JSON.stringify(output.triggerData, null, 2));
    
    console.log('\n--- Trigger Trace ---');
    console.log(JSON.stringify(output.triggerTrace, null, 2));
    
    if (output.decisionReportId) {
      console.log(`\nLinked Decision Report: ${output.decisionReportId}`);
    }
  }
  
  return 0;
}

