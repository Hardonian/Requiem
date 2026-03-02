/**
 * @fileoverview requiem verify <hash> — Top-level verification command.
 *
 * Aliases to `replay run <hash> --verify` to surface trust.
 */

import { replay } from './replay.js';

export async function runVerifyCommand(args: string[]): Promise<number> {
  // args[0] should be the hash
  if (args.length === 0) {
    console.error('Error: Execution hash required.');
    console.error('Usage: requiem verify <hash>');
    return 1;
  }

  const hash = args[0];
  
  // We need to invoke the replay command's 'run' subcommand programmatically.
  // Since Commander is designed for argv parsing, we can construct the argv.
  // But we can also just find the subcommand and run its action.
  
  const runCommand = replay.commands.find(cmd => cmd.name() === 'run');
  
  if (!runCommand) {
    console.error('Error: Replay command not found.');
    return 1;
  }
  
  // The action handler for 'run' takes (runId, options)
  // We need to cast it to any because Commander types are tricky to infer here.
  const action = (runCommand as any)._actionHandler;
  
  if (action) {
    console.log(`Verifying execution ${hash}...`);
    await action([hash], { verify: true, verbose: false });
    return 0;
  } else {
    console.error('Error: Replay action not found.');
    return 1;
  }
}

