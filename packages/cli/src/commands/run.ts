/**
 * @fileoverview requiem run <name> [input] — Unified execution command.
 *
 * Aliases to `tool exec` but with simplified syntax.
 * Future: Will intelligently dispatch to skills/agents.
 */

import { runToolExec, parseToolExecArgs } from './tool.js';

export async function runRunCommand(args: string[]): Promise<number> {
  // If the first arg is not a flag, it's the tool name.
  // If the second arg is not a flag, it's the input (assumed JSON).
  
  // We need to transform `reach run name input` into `reach tool exec name --input input`
  // But `parseToolExecArgs` expects the raw args array.
  
  // Let's manually parse for now to be safe and map to ToolExecArgs.
  
  const newArgs = [...args];
  
  // Find the name (first non-flag)
  const nameIndex = newArgs.findIndex(a => !a.startsWith('-'));
  if (nameIndex === -1) {
    console.error('Error: Tool name required.');
    console.error('Usage: requiem run <name> [input_json] [options]');
    return 1;
  }
  
  const name = newArgs[nameIndex];
  
  // Check for input as the next argument
  if (newArgs.length > nameIndex + 1 && !newArgs[nameIndex + 1].startsWith('-')) {
    const input = newArgs[nameIndex + 1];
    // Inject --input before the input value
    newArgs.splice(nameIndex + 1, 0, '--input');
  }
  
  // Now delegate to tool exec parser
  const toolArgs = parseToolExecArgs(newArgs);
  
  // Execute
  return await runToolExec(toolArgs);
}

