/**
 * @fileoverview requiem run <name> [input] — Unified execution command.
 *
 * Aliases to `tool exec` but with simplified syntax.
 * Future: Will intelligently dispatch to skills/agents.
 * 
 * USAGE:
 *   requiem run <name> [input_json] [options]
 * 
 * ARGUMENTS:
 *   name                Tool name to execute (required)
 *   input_json          JSON input to pass to tool (optional)
 * 
 * OPTIONS:
 *   --json              Output in JSON format
 *   --minimal           Quiet deterministic output
 *   --explain           Verbose structural reasoning
 *   --trace             Include trace ID in output
 *   --verify            Verify execution determinism
 * 
 * EXAMPLES:
 *   $ requiem run system.echo '{"message": "hello"}'
 *     Execute system.echo tool with JSON input
 * 
 *   $ requiem run deploy.app --json
 *     Execute deploy.app tool with JSON output
 * 
 *   $ requiem run ai.analyze --explain
 *     Execute with detailed explanation output
 */

import { runToolExec, parseToolExecArgs } from './tool.js';
import { handleCliError, ErrorCodes } from '../core/cli-helpers.js';

/**
 * Run command handler - execute a tool with simplified syntax
 */
export async function runRunCommand(args: string[]): Promise<number> {
  try {
    // If the first arg is not a flag, it's the tool name.
    // If the second arg is not a flag, it's the input (assumed JSON).
    
    const newArgs = [...args];
    
    // Find the name (first non-flag)
    const nameIndex = newArgs.findIndex(a => !a.startsWith('-'));
    if (nameIndex === -1) {
      handleCliError(
        new Error('Tool name required'),
        { 
          json: args.includes('--json'),
          minimal: args.includes('--minimal'),
          explain: args.includes('--explain'),
          trace: args.includes('--trace'),
          traceId: '',
          command: 'run',
          args,
          startTime: Date.now(),
        },
        { defaultCode: ErrorCodes.E_MISSING_ARGUMENT }
      );
    }
    
    const name = newArgs[nameIndex];
    
    // Check for input as the next argument
    if (newArgs.length > nameIndex + 1 && !newArgs[nameIndex + 1].startsWith('-')) {
      // Inject --input before the input value
      newArgs.splice(nameIndex + 1, 0, '--input');
    }
    
    // Now delegate to tool exec parser
    const toolArgs = parseToolExecArgs(newArgs);
    
    // Execute
    return await runToolExec(toolArgs);
  } catch (error) {
    handleCliError(
      error,
      {
        json: args.includes('--json'),
        minimal: args.includes('--minimal'),
        explain: args.includes('--explain'),
        trace: args.includes('--trace'),
        traceId: '',
        command: 'run',
        args,
        startTime: Date.now(),
      }
    );
  }
}
