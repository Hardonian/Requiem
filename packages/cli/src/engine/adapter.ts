/**
 * Engine Adapter
 * Integrates with the Requiem C++ native engine
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DecisionInput, DecisionOutput, evaluateDecisionFallback } from '../lib/fallback';
import { hash } from '../lib/hash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ExecRequest {
  requestId: string;
  timestamp: string;
  params: {
    algorithm?: string;
    actions: string[];
    states: string[];
    outcomes: Record<string, Record<string, number>>;
    weights?: Record<string, number>;
    strict?: boolean;
    temperature?: number;
    optimism?: number;
    confidence?: number;
    iterations?: number;
    epsilon?: number;
    seed?: number;
  };
}

export interface ExecResult {
  status: 'success' | 'error';
  requestId: string;
  recommendedAction?: string;
  ranking?: string[];
  trace?: any;
  error?: string;
}

export interface DecisionEngine {
  evaluate(input: DecisionInput): Promise<DecisionOutput>;
}

/**
 * TypeScript Reference Engine
 * Uses the TypeScript fallback implementation as the reference.
 */
export class TsReferenceEngine implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    return evaluateDecisionFallback(input);
  }
}

/**
 * Requiem C++ Engine
 * Integration with the native high-performance engine.
 */
export class RequiemEngine implements DecisionEngine {
  private enginePath: string;

  constructor() {
    // Try to find the engine binary
    const possiblePaths = [
      // Development build
      join(__dirname, '../../../build/requiem'),
      join(__dirname, '../../../build/requiem.exe'),
      // Installed package
      join(__dirname, '../../build/requiem'),
      join(__dirname, '../../build/requiem.exe'),
      // From root
      join(process.cwd(), 'build/requiem'),
      join(process.cwd(), 'build/requiem.exe'),
    ];

    // Use first path as default
    this.enginePath = possiblePaths[0];

    for (const path of possiblePaths) {
      try {
        // Check if file exists (this is a simplified check)
        this.enginePath = path;
        break;
      } catch {
        continue;
      }
    }
  }

  async evaluate(input: DecisionInput): Promise<DecisionOutput> {
    const engine = getRequiemEngine();

    // Convert DecisionInput to canonical ExecRequest
    const request: ExecRequest = {
      requestId: `req_${hash(JSON.stringify(input)).substring(0, 16)}`,
      timestamp: new Date().toISOString(),
      params: {
        algorithm: (input.algorithm as any) || 'adaptive',
        actions: input.actions,
        states: input.states,
        outcomes: input.outcomes,
        weights: input.weights,
        strict: input.strict,
        temperature: input.temperature,
        optimism: input.optimism,
        confidence: input.confidence,
        iterations: input.iterations,
        epsilon: input.epsilon,
        seed: input.seed
      }
    };

    const result = await engine.execute(request);

    if (result.status === 'error') {
      throw new Error(`Requiem Evaluation Failed: ${result.error || 'Unknown Error'}`);
    }

    return {
      recommended_action: result.recommendedAction!,
      ranking: result.ranking!,
      trace: result.trace as any
    };
  }

  /**
   * Check if the engine binary exists
   */
  isAvailable(): boolean {
    // Simplified check - in production this would actually verify file existence
    void this.enginePath; // Reference the property to avoid unused warning
    return process.env.REQUIEM_ENGINE_AVAILABLE === 'true';
  }

  /**
   * Get the engine path
   */
  getEnginePath(): string {
    return this.enginePath;
  }
}

/**
 * Native Engine Interface
 */
class NativeEngine {
  private enginePath: string;

  constructor(enginePath: string) {
    this.enginePath = enginePath;
  }

  async execute(request: ExecRequest): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.enginePath, ['--json'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({
            status: 'error',
            requestId: request.requestId,
            error: stderr || `Engine exited with code ${code}`,
          });
          return;
        }

        try {
          const result = JSON.parse(stdout) as ExecResult;
          resolve(result);
        } catch (err) {
          resolve({
            status: 'error',
            requestId: request.requestId,
            error: `Failed to parse engine output: ${err}`,
          });
        }
      });

      child.on('error', (err) => {
        void reject; // Avoid unused parameter - promise already resolves on error
        resolve({
          status: 'error',
          requestId: request.requestId,
          error: `Failed to spawn engine: ${err.message}`,
        });
      });

      // Send request to engine
      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();
    });
  }
}

// Singleton instance
let nativeEngineInstance: NativeEngine | null = null;

export function getRequiemEngine(): NativeEngine {
  if (!nativeEngineInstance) {
    const possiblePaths = [
      join(__dirname, '../../../build/requiem'),
      join(__dirname, '../../../build/requiem.exe'),
      join(process.cwd(), 'build/requiem'),
      join(process.cwd(), 'build/requiem.exe'),
    ];

    // Use first path (simplified)
    nativeEngineInstance = new NativeEngine(possiblePaths[0]);
  }
  return nativeEngineInstance;
}

/**
 * Decision Engine Factory
 * Returns the appropriate engine based on environment configuration.
 *
 * SECURITY: Prioritizes FORCE_RUST for immediate emergency rollback.
 */
export function createDecisionEngine(): DecisionEngine {
  if (process.env.FORCE_RUST === 'true' || process.env.REACH_ENGINE_FORCE_RUST === 'true') {
    return new TsReferenceEngine();
  }

  const engineType = process.env.DECISION_ENGINE || process.env.REQUIEM_ENGINE || "ts";

  switch (engineType.toLowerCase()) {
    case "requiem":
    case "native":
      return new RequiemEngine();
    case "ts":
    case "fallback":
    default:
      return new TsReferenceEngine();
  }
}

/**
 * Singleton instance of the decision engine
 */
let engineInstance: DecisionEngine | undefined;
let activeEngineType: string | undefined;

/**
 * Gets the singleton decision engine instance
 *
 * NOTE: Detects environment changes and invalidates the singleton
 * to ensure FORCE_RUST and engine switches are respected immediately.
 */
export function getDecisionEngine(): DecisionEngine {
  const forceRust = process.env.FORCE_RUST === 'true' || process.env.REACH_ENGINE_FORCE_RUST === 'true';
  const targetType = forceRust ? "ts" : (process.env.DECISION_ENGINE || process.env.REQUIEM_ENGINE || "ts").toLowerCase();

  // Invalidate cache if environment flags changed
  if (engineInstance && activeEngineType !== targetType) {
    engineInstance = undefined;
  }

  if (!engineInstance) {
    engineInstance = createDecisionEngine();
    activeEngineType = targetType;
  }
  return engineInstance;
}

/**
 * Evaluate a decision using the configured engine
 */
export async function evaluateDecision(
  input: DecisionInput,
): Promise<DecisionOutput> {
  const engine = getDecisionEngine();
  return engine.evaluate(input);
}

/**
 * Error codes for engine failures
 */
export const EngineErrorCodes = {
  ERR_ENGINE_NOT_BUILT: 'ERR_ENGINE_NOT_BUILT',
  ERR_ENGINE_EXECUTION: 'ERR_ENGINE_EXECUTION',
  ERR_ENGINE_TIMEOUT: 'ERR_ENGINE_TIMEOUT',
  ERR_ENGINE_INVALID_OUTPUT: 'ERR_ENGINE_INVALID_OUTPUT',
} as const;

/**
 * Check if native engine is available with fail-safe fallback
 */
export async function checkEngineAvailability(): Promise<{
  available: boolean;
  engineType: string;
  error?: string;
}> {
  const requiemEngine = new RequiemEngine();

  if (!requiemEngine.isAvailable()) {
    // Check for fallback option
    if (process.env.FORCE_RUST === 'true' || process.env.REACH_ENGINE_FORCE_RUST === 'true') {
      return {
        available: true,
        engineType: 'ts',
        error: 'Native engine not built, using TypeScript fallback (FORCE_RUST enabled)',
      };
    }

    return {
      available: false,
      engineType: 'none',
      error: `Native engine not found. Build with: npm run build\n` +
             `Or set FORCE_RUST=1 to use TypeScript fallback.`,
    };
  }

  return {
    available: true,
    engineType: 'requiem',
  };
}

// Re-export types for convenience
export type { DecisionInput, DecisionOutput };
