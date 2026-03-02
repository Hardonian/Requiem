/**
 * SECTION 2 — EXIT CODES + ERROR NORMALIZATION (OPERATOR GRADE)
 * 
 * Consistent exit codes across all CLI commands.
 * 
 * Exit Code Map:
 *   0 - Success / Determinism verified
 *   1 - Generic failure
 *   2 - Usage/args error
 *   3 - Config error
 *   4 - Network/provider error
 *   5 - Policy/quota denied
 *   6 - Signature verification failed
 *   7 - Invariant/determinism/replay drift
 *   8 - System/resource error (OOM, disk full, etc.)
 *   9 - Timeout/cancellation
 * 
 * This follows semantic exit codes from sysexits.h where applicable,
 * extended with domain-specific codes for provable execution.
 */

export const ExitCode = {
  SUCCESS: 0,
  FAILURE: 1,
  USAGE_ERROR: 2,
  CONFIG_ERROR: 3,
  NETWORK_ERROR: 4,
  POLICY_DENIED: 5,
  SIGNATURE_FAILED: 6,
  REPLAY_DRIFT: 7,
  SYSTEM_ERROR: 8,
  TIMEOUT: 9,
} as const;

export type ExitCodeValue = typeof ExitCode[keyof typeof ExitCode];

/**
 * Maps error types to exit codes
 */
export function errorToExitCode(error: unknown): ExitCodeValue {
  if (error && typeof error === 'object') {
    const err = error as { code?: string; name?: string };
    
    // Check error codes
    if (err.code) {
      switch (err.code) {
        case 'E_USAGE':
        case 'E_INVALID_ARGS':
        case 'E_MISSING_REQUIRED':
          return ExitCode.USAGE_ERROR;
        case 'E_CONFIG':
        case 'E_CONFIG_MISSING':
        case 'E_CONFIG_INVALID':
          return ExitCode.CONFIG_ERROR;
        case 'E_NETWORK':
        case 'E_CONNECTION':
        case 'E_PROVIDER_UNAVAILABLE':
          return ExitCode.NETWORK_ERROR;
        case 'E_POLICY_DENIED':
        case 'E_QUOTA_EXCEEDED':
        case 'E_CAPABILITY_DENIED':
          return ExitCode.POLICY_DENIED;
        case 'E_SIGNATURE_INVALID':
        case 'E_SIGNATURE_MISMATCH':
          return ExitCode.SIGNATURE_FAILED;
        case 'E_REPLAY_DRIFT':
        case 'E_DETERMINISM_FAILED':
        case 'E_INVARIANT_VIOLATION':
          return ExitCode.REPLAY_DRIFT;
        case 'E_SYSTEM':
        case 'E_DISK_FULL':
        case 'E_OUT_OF_MEMORY':
          return ExitCode.SYSTEM_ERROR;
        case 'E_TIMEOUT':
        case 'E_CANCELLED':
          return ExitCode.TIMEOUT;
      }
    }
    
    // Check error names
    if (err.name) {
      switch (err.name) {
        case 'UsageError':
          return ExitCode.USAGE_ERROR;
        case 'ConfigError':
          return ExitCode.CONFIG_ERROR;
        case 'NetworkError':
          return ExitCode.NETWORK_ERROR;
        case 'PolicyError':
          return ExitCode.POLICY_DENIED;
        case 'SignatureError':
          return ExitCode.SIGNATURE_FAILED;
        case 'ReplayError':
        case 'DeterminismError':
          return ExitCode.REPLAY_DRIFT;
        case 'SystemError':
          return ExitCode.SYSTEM_ERROR;
        case 'TimeoutError':
          return ExitCode.TIMEOUT;
      }
    }
  }
  
  // Default to generic failure
  return ExitCode.FAILURE;
}

/**
 * Exit code descriptions for human-readable output
 */
export const ExitCodeDescription: Record<ExitCodeValue, string> = {
  [ExitCode.SUCCESS]: 'Success',
  [ExitCode.FAILURE]: 'Generic failure',
  [ExitCode.USAGE_ERROR]: 'Usage error - invalid arguments or command syntax',
  [ExitCode.CONFIG_ERROR]: 'Configuration error - invalid or missing configuration',
  [ExitCode.NETWORK_ERROR]: 'Network error - provider unavailable or connection failed',
  [ExitCode.POLICY_DENIED]: 'Policy denied - quota exceeded or capability not allowed',
  [ExitCode.SIGNATURE_FAILED]: 'Signature verification failed',
  [ExitCode.REPLAY_DRIFT]: 'Replay drift - determinism invariant violated',
  [ExitCode.SYSTEM_ERROR]: 'System error - resource exhaustion or internal error',
  [ExitCode.TIMEOUT]: 'Timeout - operation exceeded time limit',
};

/**
 * Gets a human-readable description for an exit code
 */
export function describeExitCode(code: ExitCodeValue): string {
  return ExitCodeDescription[code] || `Unknown exit code: ${code}`;
}

/**
 * Normalizes any error to a structured AppError with proper exit code
 */
export interface StructuredError {
  code: string;
  message: string;
  exitCode: ExitCodeValue;
  details?: Record<string, unknown>;
  timestamp: string;
  remediation?: string;
}

export function normalizeError(
  error: unknown,
  context?: { command?: string; traceId?: string }
): StructuredError {
  const timestamp = new Date().toISOString();
  const exitCode = errorToExitCode(error);
  
  if (error && typeof error === 'object' && 'code' in error) {
    const err = error as { code: string; message?: string; details?: Record<string, unknown> };
    return {
      code: err.code,
      message: err.message || 'An error occurred',
      exitCode,
      details: { ...err.details, ...context },
      timestamp,
      remediation: getRemediation(err.code, exitCode),
    };
  }
  
  if (error instanceof Error) {
    return {
      code: 'E_UNKNOWN',
      message: error.message,
      exitCode,
      details: context,
      timestamp,
      remediation: 'Check logs or run with REQUIEM_DEBUG=1 for more details',
    };
  }
  
  return {
    code: 'E_UNKNOWN',
    message: String(error) || 'An unexpected error occurred',
    exitCode,
    details: context,
    timestamp,
    remediation: 'Check logs or run with REQUIEM_DEBUG=1 for more details',
  };
}

/**
 * Gets remediation guidance for common errors
 */
function getRemediation(code: string, exitCode: ExitCodeValue): string {
  const remediations: Record<string, string> = {
    E_USAGE: 'Run with --help to see correct usage',
    E_INVALID_ARGS: 'Check command arguments and try again',
    E_CONFIG_MISSING: 'Run "requiem init" to initialize configuration',
    E_CONFIG_INVALID: 'Check your configuration file for errors',
    E_CONNECTION: 'Check network connectivity and provider status',
    E_POLICY_DENIED: 'Review your policy settings or upgrade your tier',
    E_QUOTA_EXCEEDED: 'Wait for quota reset or upgrade your tier',
    E_SIGNATURE_INVALID: 'The execution proof is invalid or tampered',
    E_REPLAY_DRIFT: 'This execution is not deterministic - check for environment differences',
    E_DETERMINISM_FAILED: 'Non-deterministic behavior detected - review tool implementation',
    E_TIMEOUT: 'Increase timeout or reduce workload',
  };
  
  return remediations[code] || remediations[exitCode.toString()] || 'Contact support if the issue persists';
}

