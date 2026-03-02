/**
 * @fileoverview State command — Semantic State Machine operations
 *
 * Commands:
 *   reach state list [filters]      List semantic states
 *   reach state show <id>           Show state details
 *   reach state diff <idA> <idB>    Compare two states
 *   reach state graph               Generate lineage graph
 *   reach state export [options]    Export semantic ledger
 *   reach state import <file>       Import semantic ledger
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: Consistent exit codes (0 = success, 1 = error).
 * INVARIANT: No hard failures; all errors handled gracefully.
 */

import { Command } from 'commander';
import {
  getDefaultSSMStore,
  LocalSSMStore,
  computeSemanticStateId,
  classifyDrift,
  createSemanticState,
  createSemanticTransition,
  simulateModelMigration,
  DriftCategory,
  type SemanticStateDescriptor,
  type SemanticStateId,
  type SemanticState,
  type SemanticTransition,
  SemanticStateDescriptorSchema,
} from '../lib/semantic-state-machine.js';
import { readTextFile, fileExists } from '../lib/io.js';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

interface OutputContext {
  json: boolean;
  minimal: boolean;
}

function formatState(state: ReturnType<ReturnType<typeof getDefaultSSMStore>['getState']> | undefined, ctx: OutputContext): string {
  if (!state) return 'State not found';

  if (ctx.json) {
    return JSON.stringify(state, null, 2);
  }

  if (ctx.minimal) {
    return `${state.id.substring(0, 16)} ${state.descriptor.modelId} ${state.integrityScore}`;
  }

  const lines: string[] = [
    `┌────────────────────────────────────────────────────────────┐`,
    `│ SEMANTIC STATE                                             │`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  ID:           ${state.id.substring(0, 54).padEnd(54)}│`,
    `│  Created:      ${state.createdAt.padEnd(54)}│`,
    `│  Actor:        ${state.actor.padEnd(54)}│`,
    `│  Integrity:    ${(state.integrityScore + '/100').padEnd(54)}│`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  DESCRIPTOR                                                │`,
    `│    Model:      ${(`${state.descriptor.modelId}@${state.descriptor.modelVersion || 'latest'}`).padEnd(54)}│`,
    `│    Prompt:     ${(`${state.descriptor.promptTemplateId}@${state.descriptor.promptTemplateVersion}`).padEnd(54)}│`,
    `│    Policy:     ${state.descriptor.policySnapshotId.substring(0, 16).padEnd(54)}│`,
    `│    Context:    ${state.descriptor.contextSnapshotId.substring(0, 16).padEnd(54)}│`,
    `│    Runtime:    ${state.descriptor.runtimeId.padEnd(54)}│`,
  ];

  if (state.descriptor.evalSnapshotId) {
    lines.push(`│    Eval:       ${state.descriptor.evalSnapshotId.substring(0, 16).padEnd(54)}│`);
  }

  if (state.labels && Object.keys(state.labels).length > 0) {
    lines.push(`├────────────────────────────────────────────────────────────┤`);
    lines.push(`│  LABELS                                                    │`);
    for (const [key, value] of Object.entries(state.labels)) {
      lines.push(`│    ${key}: ${String(value).padEnd(54 - key.length - 4)}│`);
    }
  }

  if (state.evidenceRefs && state.evidenceRefs.length > 0) {
    lines.push(`├────────────────────────────────────────────────────────────┤`);
    lines.push(`│  EVIDENCE                                                  │`);
    for (const ref of state.evidenceRefs.slice(0, 5)) {
      lines.push(`│    ${ref.substring(0, 54).padEnd(54)}│`);
    }
    if (state.evidenceRefs.length > 5) {
      lines.push(`│    ... and ${(state.evidenceRefs.length - 5 + ' more').padEnd(45)}│`);
    }
  }

  lines.push(`└────────────────────────────────────────────────────────────┘`);

  return lines.join('\n');
}

function formatStatesTable(states: SemanticState[], ctx: OutputContext): string {
  if (states.length === 0) {
    return ctx.json ? '[]' : 'No states found';
  }

  if (ctx.json) {
    return JSON.stringify(states, null, 2);
  }

  if (ctx.minimal) {
    return states.map(s => `${s.id.substring(0, 16)} ${s.descriptor.modelId} ${s.integrityScore}`).join('\n');
  }

  const lines: string[] = [
    `┌────────────────────────┬─────────────────┬────────────┬────────────────────────┐`,
    `│ State ID               │ Model           │ Integrity  │ Created                │`,
    `├────────────────────────┼─────────────────┼────────────┼────────────────────────┤`,
  ];

  for (const state of states.slice(0, 20)) {
    const shortId = state.id.substring(0, 16).padEnd(16);
    const model = (state.descriptor.modelId.substring(0, 13) + (state.descriptor.modelId.length > 13 ? '...' : '')).padEnd(15);
    const integrity = String(state.integrityScore).padStart(6);
    const created = state.createdAt.substring(0, 19).padEnd(19);
    lines.push(`│ ${shortId} │ ${model} │ ${integrity}/100 │ ${created} │`);
  }

  if (states.length > 20) {
    lines.push(`│ ... and ${String(states.length - 20).padEnd(54)} more rows ...            │`);
  }

  lines.push(`└────────────────────────┴─────────────────┴────────────┴────────────────────────┘`);
  lines.push(`Total: ${states.length} states`);

  return lines.join('\n');
}

function formatDiff(
  stateA: SemanticState,
  stateB: SemanticState,
  ctx: OutputContext
): string {
  const drift = classifyDrift(stateA.descriptor, stateB.descriptor);

  if (ctx.json) {
    return JSON.stringify({
      stateA: { id: stateA.id, integrity: stateA.integrityScore },
      stateB: { id: stateB.id, integrity: stateB.integrityScore },
      drift,
      integrityDelta: stateB.integrityScore - stateA.integrityScore,
    }, null, 2);
  }

  const lines: string[] = [
    `┌────────────────────────────────────────────────────────────┐`,
    `│ SEMANTIC DIFF                                              │`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  State A: ${stateA.id.substring(0, 49).padEnd(49)}│`,
    `│  State B: ${stateB.id.substring(0, 49).padEnd(49)}│`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  DRIFT CATEGORIES                                          │`,
  ];

  if (drift.driftCategories.length === 0) {
    lines.push(`│    No drift detected (identical descriptors)               │`);
  } else {
    for (const category of drift.driftCategories) {
      lines.push(`│    • ${category.padEnd(54)}│`);
    }
  }

  lines.push(`├────────────────────────────────────────────────────────────┤`);
  lines.push(`│  CHANGE VECTORS                                            │`);

  if (drift.changeVectors.length === 0) {
    lines.push(`│    No changes detected                                     │`);
  } else {
    for (const cv of drift.changeVectors) {
      lines.push(`│                                                            │`);
      lines.push(`│  Path: ${cv.path.padEnd(53)}│`);
      lines.push(`│  From: ${String(cv.from).substring(0, 53).padEnd(53)}│`);
      lines.push(`│  To:   ${String(cv.to).substring(0, 53).padEnd(53)}│`);
      lines.push(`│  Significance: ${cv.significance.padEnd(45)}│`);
    }
  }

  lines.push(`├────────────────────────────────────────────────────────────┤`);
  lines.push(`│  INTEGRITY                                                 │`);
  lines.push(`│    State A: ${String(stateA.integrityScore).padEnd(42)}/100 │`);
  lines.push(`│    State B: ${String(stateB.integrityScore).padEnd(42)}/100 │`);
  lines.push(`│    Delta:   ${String(stateB.integrityScore - stateA.integrityScore).padStart(5).padEnd(42)}    │`);
  lines.push(`└────────────────────────────────────────────────────────────┘`);

  return lines.join('\n');
}

function formatGraph(dotGraph: string, ctx: OutputContext): string {
  if (ctx.json) {
    return JSON.stringify({ format: 'dot', graph: dotGraph });
  }
  return dotGraph;
}

function formatMigrationResult(
  result: ReturnType<typeof simulateModelMigration>,
  ctx: OutputContext
): string {
  if (ctx.json) {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [
    `┌────────────────────────────────────────────────────────────┐`,
    `│ MODEL MIGRATION SIMULATION                                 │`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  From: ${result.fromModel.padEnd(51)}│`,
    `│  To:   ${result.toModel.padEnd(51)}│`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  SUMMARY                                                   │`,
    `│    Total states analyzed: ${String(result.totalStates).padEnd(32)}│`,
    `│    Needs re-evaluation:   ${String(result.summary.needsReEval).padEnd(32)}│`,
    `│    Policy risk:           ${String(result.summary.policyRisk).padEnd(32)}│`,
    `│    Replay break:          ${String(result.summary.replayBreak).padEnd(32)}│`,
    `│    Compatible:            ${String(result.summary.compatible).padEnd(32)}│`,
  ];

  if (result.impacts.length > 0) {
    lines.push(`├────────────────────────────────────────────────────────────┤`);
    lines.push(`│  DETAILED IMPACTS                                          │`);

    for (const impact of result.impacts.slice(0, 10)) {
      lines.push(`│                                                            │`);
      lines.push(`│  State: ${impact.stateId.substring(0, 48).padEnd(48)}│`);
      lines.push(`│  Risk:  ${impact.riskCategory.padEnd(48)}│`);
      lines.push(`│  Conf:  ${impact.confidence.padEnd(48)}│`);
      lines.push(`│  ${impact.reason.substring(0, 52).padEnd(52)}│`);
    }

    if (result.impacts.length > 10) {
      lines.push(`│  ... and ${String(result.impacts.length - 10).padEnd(45)} more ... │`);
    }
  }

  lines.push(`└────────────────────────────────────────────────────────────┘`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function createStateCommand(): Command {
  const stateCmd = new Command('state')
    .description('Semantic State Machine operations')
    .option('--json', 'Output in JSON format')
    .option('--minimal', 'Minimal output format');

  // List command
  stateCmd
    .command('list')
    .description('List semantic states')
    .option('--model <model>', 'Filter by model ID')
    .option('--policy <policy>', 'Filter by policy snapshot ID')
    .option('--min-score <score>', 'Filter by minimum integrity score', parseInt)
    .option('--label <key=value>', 'Filter by label (can be used multiple times)', collectLabels, {})
    .action((options) => {
      try {
        const store = getDefaultSSMStore();
        const filter: Parameters<typeof store.listStates>[0] = {};

        if (options.model) filter.modelId = options.model;
        if (options.policy) filter.policySnapshotId = options.policy;
        if (options.minScore !== undefined) filter.minIntegrityScore = options.minScore;
        if (Object.keys(options.label).length > 0) filter.labels = options.label;

        const states = store.listStates(filter);
        const output = formatStatesTable(states, { json: options.json, minimal: options.minimal });
        process.stdout.write(output + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error, 'list', { json: options.json, minimal: options.minimal });
      }
    });

  // Show command
  stateCmd
    .command('show')
    .description('Show state details')
    .argument('<id>', 'State ID (full or first 8 chars)')
    .action((id, options) => {
      try {
        const store = getDefaultSSMStore();
        const states = store.listStates();

        // Find state by full ID or prefix
        let state = store.getState(id);
        if (!state) {
          state = states.find(s => s.id.startsWith(id));
        }

        if (!state) {
          process.stderr.write(`Error: State not found: ${id}\n`);
          process.exit(1);
        }

        const output = formatState(state, { json: options.json, minimal: options.minimal });
        process.stdout.write(output + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error, 'show', { json: options.json, minimal: options.minimal });
      }
    });

  // Diff command
  stateCmd
    .command('diff')
    .description('Compare two states')
    .argument('<idA>', 'First state ID')
    .argument('<idB>', 'Second state ID')
    .action((idA, idB, options) => {
      try {
        const store = getDefaultSSMStore();
        const states = store.listStates();

        // Find states
        const stateA = store.getState(idA) || states.find(s => s.id.startsWith(idA));
        const stateB = store.getState(idB) || states.find(s => s.id.startsWith(idB));

        if (!stateA) {
          process.stderr.write(`Error: State not found: ${idA}\n`);
          process.exit(1);
        }
        if (!stateB) {
          process.stderr.write(`Error: State not found: ${idB}\n`);
          process.exit(1);
        }

        const output = formatDiff(stateA, stateB, { json: options.json, minimal: options.minimal });
        process.stdout.write(output + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error, 'diff', { json: options.json, minimal: options.minimal });
      }
    });

  // Graph command
  stateCmd
    .command('graph')
    .description('Generate lineage graph (DOT format)')
    .action((options) => {
      try {
        const store = getDefaultSSMStore() as LocalSSMStore;
        const dotGraph = store.toDotGraph();
        const output = formatGraph(dotGraph, { json: options.json, minimal: options.minimal });
        process.stdout.write(output + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error, 'graph', { json: options.json, minimal: options.minimal });
      }
    });

  // Export command
  stateCmd
    .command('export')
    .description('Export semantic ledger bundle')
    .option('--output <file>', 'Output file path')
    .option('--since <date>', 'Export states created since date (ISO 8601)')
    .action((options) => {
      try {
        const store = getDefaultSSMStore();
        const bundle = store.exportBundle();

        // Filter by date if specified
        if (options.since) {
          const sinceDate = new Date(options.since);
          bundle.states = bundle.states.filter(s => new Date(s.createdAt) >= sinceDate);
          bundle.transitions = bundle.transitions.filter(t => new Date(t.timestamp) >= sinceDate);
        }

        const json = JSON.stringify(bundle, null, 2);

        if (options.output) {
          writeFileSync(options.output, json);
          process.stdout.write(`Exported ${bundle.states.length} states and ${bundle.transitions.length} transitions to ${options.output}\n`);
        } else {
          process.stdout.write(json + '\n');
        }
        process.exit(0);
      } catch (error) {
        handleError(error, 'export', { json: options.json, minimal: options.minimal });
      }
    });

  // Import command
  stateCmd
    .command('import')
    .description('Import semantic ledger bundle')
    .argument('<file>', 'Bundle file path (JSON)')
    .action((file, options) => {
      try {
        if (!fileExists(file)) {
          process.stderr.write(`Error: File not found: ${file}\n`);
          process.exit(1);
        }

        const content = readFileSync(file, 'utf-8');
        const bundle = JSON.parse(content);

        const store = getDefaultSSMStore();
        const beforeStates = store.listStates().length;
        const beforeTransitions = (store as LocalSSMStore)['transitions']?.length || 0;

        store.importBundle(bundle);

        const afterStates = store.listStates().length;

        if (options.json) {
          process.stdout.write(JSON.stringify({
            success: true,
            imported: {
              states: afterStates - beforeStates,
              transitions: bundle.transitions.length,
            },
            total: {
              states: afterStates,
            },
          }) + '\n');
        } else {
          process.stdout.write(`Imported ${afterStates - beforeStates} new states\n`);
          process.stdout.write(`Total states in store: ${afterStates}\n`);
        }
        process.exit(0);
      } catch (error) {
        handleError(error, 'import', { json: options.json, minimal: options.minimal });
      }
    });

  // Simulate command (nested under state for discoverability)
  const simulateCmd = stateCmd
    .command('simulate')
    .description('Simulation operations');

  simulateCmd
    .command('upgrade')
    .description('Simulate model upgrade impact')
    .requiredOption('--from <model>', 'Source model ID')
    .requiredOption('--to <model>', 'Target model ID')
    .option('--policy <ref>', 'Policy snapshot reference')
    .option('--eval <ref>', 'Evaluation snapshot reference')
    .action((options) => {
      try {
        const store = getDefaultSSMStore();
        const result = simulateModelMigration(
          store,
          options.from,
          options.to,
          {
            policyRef: options.policy,
            evalRef: options.eval,
          }
        );

        const output = formatMigrationResult(result, { json: options.json, minimal: options.minimal });
        process.stdout.write(output + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error, 'simulate upgrade', { json: options.json, minimal: options.minimal });
      }
    });

  // Genesis command (for creating initial states)
  stateCmd
    .command('genesis')
    .description('Create a genesis state from descriptor')
    .requiredOption('--descriptor <file>', 'Path to descriptor JSON file')
    .option('--actor <actor>', 'Actor creating the state', 'cli')
    .option('--label <key=value>', 'Labels to attach', collectLabels, {})
    .action((options) => {
      try {
        if (!fileExists(options.descriptor)) {
          process.stderr.write(`Error: Descriptor file not found: ${options.descriptor}\n`);
          process.exit(1);
        }

        const content = readFileSync(options.descriptor, 'utf-8');
        const parsed = JSON.parse(content);
        const descriptor = SemanticStateDescriptorSchema.parse(parsed);

        const state = createSemanticState(descriptor, {
          actor: options.actor,
          labels: Object.keys(options.label).length > 0 ? options.label : undefined,
        });

        const store = getDefaultSSMStore();
        store.putState(state);

        // Create genesis transition
        const transition = createSemanticTransition(null, state, 'Genesis state created');
        store.appendTransition(transition);

        if (options.json) {
          process.stdout.write(JSON.stringify({
            success: true,
            stateId: state.id,
            integrityScore: state.integrityScore,
          }) + '\n');
        } else {
          process.stdout.write(`Created genesis state: ${state.id.substring(0, 16)}...\n`);
          process.stdout.write(`Integrity score: ${state.integrityScore}/100\n`);
        }
        process.exit(0);
      } catch (error) {
        handleError(error, 'genesis', { json: options.json, minimal: options.minimal });
      }
    });

  // Transition command
  stateCmd
    .command('transition')
    .description('Create a transition between states')
    .requiredOption('--from <id>', 'Source state ID (omit for genesis)')
    .requiredOption('--to <id>', 'Target state ID')
    .requiredOption('--reason <reason>', 'Reason for transition')
    .action((options) => {
      try {
        const store = getDefaultSSMStore();

        const fromState = options.from ? (store.getState(options.from) || store.listStates().find(s => s.id.startsWith(options.from))) : null;
        const toState = store.getState(options.to) || store.listStates().find(s => s.id.startsWith(options.to));

        if (options.from && !fromState) {
          process.stderr.write(`Error: Source state not found: ${options.from}\n`);
          process.exit(1);
        }
        if (!toState) {
          process.stderr.write(`Error: Target state not found: ${options.to}\n`);
          process.exit(1);
        }

        const transition = createSemanticTransition(fromState || null, toState, options.reason);
        store.appendTransition(transition);

        if (options.json) {
          process.stdout.write(JSON.stringify({
            success: true,
            transition: {
              fromId: transition.fromId,
              toId: transition.toId,
              driftCategories: transition.driftCategories,
              integrityDelta: transition.integrityDelta,
            },
          }) + '\n');
        } else {
          process.stdout.write(`Created transition: ${transition.fromId?.substring(0, 8) || 'GENESIS'} -> ${transition.toId.substring(0, 8)}\n`);
          process.stdout.write(`Drift categories: ${transition.driftCategories.join(', ') || 'none'}\n`);
        }
        process.exit(0);
      } catch (error) {
        handleError(error, 'transition', { json: options.json, minimal: options.minimal });
      }
    });

  return stateCmd;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function collectLabels(value: string, previous: Record<string, string>): Record<string, string> {
  const [key, val] = value.split('=');
  if (key && val) {
    previous[key] = val;
  }
  return previous;
}

function handleError(error: unknown, command: string, ctx: OutputContext): never {
  const message = error instanceof Error ? error.message : String(error);

  if (ctx.json) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: message,
      command,
    }) + '\n');
  } else {
    process.stderr.write(`Error in "state ${command}": ${message}\n`);
  }
  process.exit(1);
}

// Default export for dynamic imports
export default createStateCommand;
