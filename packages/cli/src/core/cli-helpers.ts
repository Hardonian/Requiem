/**
 * CLI Helpers - Consistent formatting and error handling for CLI commands
 * 
 * Provides:
 * - Deterministic JSON output (stable key ordering)
 * - Consistent error formatting
 * - Help text templates
 */

import { CommandContext } from '../cli.js';

/**
 * Serialize data to JSON with deterministic key ordering
 * Ensures stable output for testing and verification
 */
export function deterministicJson(data: unknown, space = 2): string {
  return JSON.stringify(data, Object.keys(data as object).sort(), space);
}

/**
 * Stable key sort for complex nested objects
 */
export function stableSortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(stableSortKeys);
  }
  
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = stableSortKeys((obj as Record<string, unknown>)[key]);
  }
  
  return sorted;
}

/**
 * CLI Error structure - actionable errors without stack traces
 */
export interface CLIError {
  code: string;
  message: string;
  hint?: string;
  traceId?: string;
  timestamp: string;
}

/**
 * Create a standardized CLI error
 */
export function createError(
  code: string,
  message: string,
  options: { hint?: string; traceId?: string } = {}
): CLIError {
  return {
    code,
    message,
    hint: options.hint,
    traceId: options.traceId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format error for output
 */
export function formatError(error: CLIError, ctx: CommandContext): string {
  if (ctx.json) {
    return deterministicJson({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.hint && { hint: error.hint }),
      },
      ...(error.traceId && { traceId: error.traceId }),
      timestamp: error.timestamp,
    });
  }
  
  let output = `[${error.code}] ${error.message}`;
  if (error.hint && ctx.explain) {
    output += `\n  Hint: ${error.hint}`;
  }
  return output;
}

/**
 * Format success response
 */
export function formatSuccess(
  data: Record<string, unknown>,
  ctx: CommandContext,
  meta?: Record<string, unknown>
): string {
  const output = {
    success: true,
    ...data,
    ...(meta && { meta }),
    ...(ctx.trace && { traceId: ctx.traceId }),
  };
  
  if (ctx.json) {
    return deterministicJson(stableSortKeys(output));
  }
  
  // Human-readable format
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join('\n');
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Standardized help text template
 */
export interface HelpTemplate {
  description: string;
  usage: string;
  arguments?: Array<{ name: string; description: string; required?: boolean }>;
  options?: Array<{ flag: string; description: string; default?: string }>;
  examples: Array<{ command: string; description: string }>;
}

/**
 * Generate formatted help text
 */
export function generateHelp(template: HelpTemplate): string {
  const lines: string[] = [];
  
  lines.push(template.description);
  lines.push('');
  
  lines.push('USAGE:');
  lines.push(`  ${template.usage}`);
  lines.push('');
  
  if (template.arguments && template.arguments.length > 0) {
    lines.push('ARGUMENTS:');
    for (const arg of template.arguments) {
      const req = arg.required ? '' : ' (optional)';
      lines.push(`  ${arg.name.padEnd(20)} ${arg.description}${req}`);
    }
    lines.push('');
  }
  
  if (template.options && template.options.length > 0) {
    lines.push('OPTIONS:');
    // Sort options alphabetically by flag
    const sortedOptions = [...template.options].sort((a, b) => a.flag.localeCompare(b.flag));
    for (const opt of sortedOptions) {
      const def = opt.default ? ` (default: ${opt.default})` : '';
      lines.push(`  ${opt.flag.padEnd(20)} ${opt.description}${def}`);
    }
    lines.push('');
  }
  
  lines.push('EXAMPLES:');
  for (const ex of template.examples) {
    lines.push(`  $ ${ex.command}`);
    lines.push(`    ${ex.description}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Input errors
  E_INVALID_INPUT: 'E_INVALID_INPUT',
  E_MISSING_ARGUMENT: 'E_MISSING_ARGUMENT',
  E_INVALID_JSON: 'E_INVALID_JSON',
  
  // Execution errors
  E_EXECUTION_FAILED: 'E_EXECUTION_FAILED',
  E_POLICY_DENIED: 'E_POLICY_DENIED',
  E_CAPABILITY_DENIED: 'E_CAPABILITY_DENIED',
  E_BUDGET_EXCEEDED: 'E_BUDGET_EXCEEDED',
  
  // System errors
  E_NETWORK_ERROR: 'E_NETWORK_ERROR',
  E_DATABASE_ERROR: 'E_DATABASE_ERROR',
  E_ENGINE_ERROR: 'E_ENGINE_ERROR',
  
  // Resource errors
  E_NOT_FOUND: 'E_NOT_FOUND',
  E_ALREADY_EXISTS: 'E_ALREADY_EXISTS',
  E_CONFLICT: 'E_CONFLICT',
  
  // Unknown
  E_UNKNOWN: 'E_UNKNOWN',
} as const;

/**
 * Common hints for error codes
 */
export const ErrorHints: Record<string, string> = {
  [ErrorCodes.E_INVALID_INPUT]: 'Check the command syntax and try again.',
  [ErrorCodes.E_MISSING_ARGUMENT]: 'Ensure all required arguments are provided.',
  [ErrorCodes.E_INVALID_JSON]: 'Verify the JSON is well-formed.',
  [ErrorCodes.E_POLICY_DENIED]: 'Check policy configuration with: requiem policy list',
  [ErrorCodes.E_CAPABILITY_DENIED]: 'Create a capability with: reach caps mint --scope <scope>',
  [ErrorCodes.E_BUDGET_EXCEEDED]: 'View budgets with: requiem economics',
  [ErrorCodes.E_NOT_FOUND]: 'Verify the resource exists and the identifier is correct.',
  [ErrorCodes.E_DATABASE_ERROR]: 'Check database connectivity with: requiem doctor',
};

/**
 * Handle CLI errors consistently
 */
export function handleCliError(
  error: unknown,
  ctx: CommandContext,
  options: { defaultCode?: string; defaultHint?: string } = {}
): never {
  let cliError: CLIError;
  
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    // Already a structured error
    cliError = {
      code: String((error as { code: string }).code),
      message: String((error as { message: string }).message),
      hint: (error as { hint?: string }).hint || ErrorHints[(error as { code: string }).code],
      traceId: ctx.traceId,
      timestamp: new Date().toISOString(),
    };
  } else {
    // Convert unknown error
    const message = error instanceof Error ? error.message : String(error);
    const code = options.defaultCode || ErrorCodes.E_UNKNOWN;
    cliError = {
      code,
      message,
      hint: options.defaultHint || ErrorHints[code],
      traceId: ctx.traceId,
      timestamp: new Date().toISOString(),
    };
  }
  
  const output = formatError(cliError, ctx);
  process.stderr.write(output + '\n');
  process.exit(1);
}
