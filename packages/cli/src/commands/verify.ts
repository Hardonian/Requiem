/**
 * @fileoverview requiem verify <hash> — Top-level verification command.
 *
 * Verifies execution determinism by replaying and comparing fingerprints.
 * Aliases to `replay run <hash> --verify` to surface trust.
 * 
 * USAGE:
 *   requiem verify <hash> [options]
 * 
 * ARGUMENTS:
 *   hash                Execution hash to verify (required)
 * 
 * OPTIONS:
 *   --json              Output in JSON format
 *   --minimal           Quiet deterministic output
 *   --explain           Verbose structural reasoning
 *   --trace             Include trace ID in output
 * 
 * EXAMPLES:
 *   $ requiem verify sha256:abc123...
 *     Verify execution by hash
 * 
 *   $ requiem verify abc123 --json
 *     Verify and output result as JSON
 */

import { replay } from './replay.js';
import { runProofPackVerifyCommand } from './infrastructure.js';
import { handleCliError, ErrorCodes, createError } from '../core/cli-helpers.js';
import type { CommandContext } from '../cli.js';

/**
 * Verify command handler - verify execution determinism
 */
export async function runVerifyCommand(
  args: string[],
  ctx: CommandContext
): Promise<number> {
  try {
    // args[0] should be the hash
    if (args.length === 0) {
      throw createError(
        ErrorCodes.E_MISSING_ARGUMENT,
        'Execution hash required',
        { hint: 'Provide a hash from a previous execution: requiem verify <hash>' }
      );
    }

    const hash = args[0];

    if (hash === 'proof-pack') {
      return runProofPackVerifyCommand(ctx);
    }
    
    // We need to invoke the replay command's 'run' subcommand programmatically.
    const runCommand = replay.commands.find(cmd => cmd.name() === 'run');
    
    if (!runCommand) {
      throw createError(
        ErrorCodes.E_ENGINE_ERROR,
        'Replay command not found',
        { hint: 'The replay system may not be properly initialized.' }
      );
    }
    
    // The action handler for 'run' takes (runId, options)
    const action = (runCommand as unknown as { _actionHandler?: (args: string[], options: { verify: boolean; verbose: boolean }) => Promise<void> })._actionHandler;
    
    if (action) {
      if (!ctx.minimal) {
        process.stdout.write(`Verifying execution ${hash}...\n`);
      }
      await action([hash], { verify: true, verbose: ctx.explain });
      return 0;
    } else {
      throw createError(
        ErrorCodes.E_ENGINE_ERROR,
        'Replay action not found',
        { hint: 'The replay system may not be properly initialized.' }
      );
    }
  } catch (error) {
    handleCliError(error, ctx);
  }
}
