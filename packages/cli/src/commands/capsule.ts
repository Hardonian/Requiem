/**
 * @fileoverview Capsule command — Replay Attestation Bundle
 *
 * Commands:
 *   reach capsule export <state-id>     Export capsule for a state
 *   reach capsule verify <file>         Verify capsule integrity
 *   reach capsule info <file>           Show capsule summary
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: No network required.
 * INVARIANT: Fail-closed on verification.
 */

import { Command } from 'commander';
import {
  writeTextFile,
  fileExists,
  readTextFile,
} from '../lib/io.js';
import {
  getDefaultSSMStore,
  LocalSSMStore,
  type SemanticState,
  type SemanticStateId,
} from '../lib/semantic-state-machine.js';
import {
  createCapsule,
  verifyCapsule,
  quickVerifyCapsule,
  serializeCapsule,
  deserializeCapsule,
  getCapsuleSummary,
  type ReplayAttestationCapsule,
} from '../lib/replay-capsule.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createCapsuleCommand(): Command {
  const capsuleCmd = new Command('capsule')
    .description('Replay Attestation Capsule — portable verifiable run proofs')
    .option('--json', 'Output in JSON format');

  // Export command
  capsuleCmd
    .command('export')
    .description('Export a replay attestation capsule for a state')
    .argument('<state-id>', 'State ID (full or prefix)')
    .option('--output <file>', 'Output file path')
    .option('--lineage-depth <n>', 'Number of ancestors to include', parseInt, 5)
    .option('--policy-desc <desc>', 'Policy snapshot description')
    .option('--context-desc <desc>', 'Context snapshot description')
    .action((stateIdArg, options) => {
      try {
        const store = getDefaultSSMStore();
        const allStates = store.listStates();

        // Find state
        let state = store.getState(stateIdArg as SemanticStateId);
        if (!state) {
          state = allStates.find(s => s.id.startsWith(stateIdArg));
        }

        if (!state) {
          handleError(`State not found: ${stateIdArg}`, options.parent?.json);
          return;
        }

        // Build lineage slice
        const lineage: Array<{ state: SemanticState; transition?: ReturnType<LocalSSMStore['getTransitionsTo']>[0] }> = [];
        let currentState = state;
        const storeLocal = store as LocalSSMStore;

        for (let i = 0; i < options.lineageDepth; i++) {
          const transitions = storeLocal.getTransitionsTo(currentState.id as SemanticStateId);
          if (transitions.length === 0) break;

          const transition = transitions[0]; // Take first parent
          lineage.push({ state: currentState, transition });

          if (transition.fromId) {
            const parentState = store.getState(transition.fromId as SemanticStateId) ||
              allStates.find(s => s.id === transition.fromId);
            if (!parentState) break;
            currentState = parentState;
          } else {
            // Genesis
            lineage.push({ state: currentState });
            break;
          }
        }

        // Reverse so oldest first
        lineage.reverse();

        // Create capsule
        const capsule = createCapsule(
          state,
          lineage,
          options.policyDesc,
          options.contextDesc
        );

        const serialized = serializeCapsule(capsule);

        if (options.output) {
          writeTextFile(options.output, serialized);

          if (options.parent?.json) {
            process.stdout.write(JSON.stringify({
              success: true,
              capsuleId: capsule.id,
              stateId: state.id,
              outputPath: options.output,
              checksum: capsule.checksum,
            }) + '\n');
          } else {
            process.stdout.write(`Exported capsule: ${capsule.id}\n`);
            process.stdout.write(`State: ${state.id.substring(0, 16)}...\n`);
            process.stdout.write(`Saved to: ${options.output}\n`);
            process.stdout.write(`Checksum: ${capsule.checksum.substring(0, 16)}...\n`);
          }
        } else {
          // Output to stdout
          process.stdout.write(serialized + '\n');
        }

        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Verify command
  capsuleCmd
    .command('verify')
    .description('Verify a replay attestation capsule')
    .argument('<file>', 'Capsule file path')
    .option('--quick', 'Quick verify (checksum only)')
    .action((file, options) => {
      try {
        if (!fileExists(file)) {
          handleError(`File not found: ${file}`, options.parent?.json);
          return;
        }

        const content = readTextFile(file);
        let capsule: ReplayAttestationCapsule;

        try {
          capsule = deserializeCapsule(content);
        } catch (e) {
          handleError(`Invalid capsule format: ${e instanceof Error ? e.message : String(e)}`, options.parent?.json);
          return;
        }

        let result: { valid: boolean; errors: string[]; summary: string };

        if (options.quick) {
          const valid = quickVerifyCapsule(capsule);
          result = {
            valid,
            errors: valid ? [] : ['Quick verification failed'],
            summary: valid ? 'Quick verification passed' : 'Quick verification failed',
          };
        } else {
          result = verifyCapsule(capsule);
        }

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          if (result.valid) {
            process.stdout.write(`✓ ${result.summary}\n`);
            process.stdout.write(`  Capsule: ${capsule.id}\n`);
            process.stdout.write(`  State: ${capsule.semanticState.id.substring(0, 16)}...\n`);
            process.stdout.write(`  Checksum: ${capsule.checksum.substring(0, 16)}...\n`);
          } else {
            process.stdout.write(`✗ ${result.summary}\n`);
            for (const error of result.errors) {
              process.stdout.write(`  - ${error}\n`);
            }
          }
        }

        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Info command
  capsuleCmd
    .command('info')
    .description('Show capsule summary information')
    .argument('<file>', 'Capsule file path')
    .action((file, options) => {
      try {
        if (!fileExists(file)) {
          handleError(`File not found: ${file}`, options.parent?.json);
          return;
        }

        const content = readTextFile(file);
        const capsule = deserializeCapsule(content);
        const summary = getCapsuleSummary(capsule);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            capsuleId: summary.id,
            stateId: summary.stateId,
            model: summary.model,
            integrityScore: summary.integrity,
            lineageDepth: summary.lineageDepth,
            createdAt: summary.createdAt,
            capsuleCreatedAt: capsule.createdAt,
          }, null, 2) + '\n');
        } else {
          process.stdout.write(`Capsule: ${summary.id}\n`);
          process.stdout.write(`State: ${summary.stateId}\n`);
          process.stdout.write(`Model: ${summary.model}\n`);
          process.stdout.write(`Integrity: ${summary.integrity}/100\n`);
          process.stdout.write(`Lineage Depth: ${summary.lineageDepth} state(s)\n`);
          process.stdout.write(`Capsule Created: ${summary.createdAt}\n`);
        }

        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  return capsuleCmd;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function handleError(error: unknown, json: boolean): never {
  const message = error instanceof Error ? error.message : String(error);

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
export default createCapsuleCommand;
