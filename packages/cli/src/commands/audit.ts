/**
 * @fileoverview Audit command — Generate deterministic audit narratives
 *
 * Commands:
 *   reach audit report <state-id>      Generate audit report for a state
 *   reach audit transition <from> <to> Generate audit report for a transition
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: Deterministic output (no LLM involvement).
 * INVARIANT: Suitable for compliance tickets.
 */

import { Command } from 'commander';
import {
  getDefaultSSMStore,
  LocalSSMStore,
  type SemanticState,
  type SemanticStateId,
} from '../lib/semantic-state-machine.js';
import {
  generateAuditReport,
  generateTransitionAuditReport,
  type AuditFormat,
} from '../lib/audit-narrative.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createAuditCommand(): Command {
  const auditCmd = new Command('audit')
    .description('Generate deterministic audit narratives from SSM signals')
    .option('--json', 'Output in JSON format')
    .option('--no-recommendations', 'Omit recommendations section');

  // Report command for states
  auditCmd
    .command('report')
    .description('Generate audit report for a semantic state')
    .argument('<state-id>', 'State ID (full or prefix)')
    .action((stateIdArg, options) => {
      try {
        const store = getDefaultSSMStore();

        // Find state by full ID or prefix
        let state = store.getState(stateIdArg as SemanticStateId);
        if (!state) {
          const allStates = store.listStates();
          state = allStates.find(s => s.id.startsWith(stateIdArg));
        }

        if (!state) {
          handleError(`State not found: ${stateIdArg}`, options.parent?.json);
          return;
        }

        const format: AuditFormat = options.parent?.json ? 'json' : 'markdown';
        const includeRecommendations = options.parent?.recommendations !== false;

        const report = generateAuditReport(state, {
          format,
          includeRecommendations,
        });

        process.stdout.write(report + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error instanceof Error ? error.message : String(error), options.parent?.json);
      }
    });

  // Transition command
  auditCmd
    .command('transition')
    .description('Generate audit report for a state transition')
    .argument('<from-id>', 'Source state ID (or "genesis")')
    .argument('<to-id>', 'Target state ID')
    .action((fromIdArg, toIdArg, options) => {
      try {
        const store = getDefaultSSMStore();
        const allStates = store.listStates();

        // Find states
        let fromState: SemanticState | null = null;
        if (fromIdArg.toLowerCase() !== 'genesis') {
          fromState = store.getState(fromIdArg as SemanticStateId) ||
            allStates.find(s => s.id.startsWith(fromIdArg)) ||
            null;

          if (!fromState) {
            handleError(`Source state not found: ${fromIdArg}`, options.parent?.json);
            return;
          }
        }

        const toState = store.getState(toIdArg as SemanticStateId) ||
          allStates.find(s => s.id.startsWith(toIdArg));

        if (!toState) {
          handleError(`Target state not found: ${toIdArg}`, options.parent?.json);
          return;
        }

        // Find the transition
        const transitions = (store as LocalSSMStore).getTransitionsTo(toState.id as SemanticStateId);
        const transition = transitions.find(t =>
          fromState ? t.fromId === fromState.id : t.fromId === undefined
        ) || transitions[0];

        if (!transition) {
          handleError(`No transition found from ${fromIdArg} to ${toIdArg}`, options.parent?.json);
          return;
        }

        const format: AuditFormat = options.parent?.json ? 'json' : 'markdown';
        const includeRecommendations = options.parent?.recommendations !== false;

        const report = generateTransitionAuditReport(fromState, toState, transition, {
          format,
          includeRecommendations,
        });

        process.stdout.write(report + '\n');
        process.exit(0);
      } catch (error) {
        handleError(error instanceof Error ? error.message : String(error), options.parent?.json);
      }
    });

  return auditCmd;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function handleError(message: string, json: boolean): never {
  if (json) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: message,
    }) + '\n');
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  process.exit(1);
}

// Default export for dynamic imports
export default createAuditCommand;
