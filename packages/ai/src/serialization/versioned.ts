/**
 * @fileoverview Versioned Deterministic Serialization
 * 
 * Provides canonical serialization for:
 * - Plans
 * - Execution events
 * - Artifact manifests
 * 
 * Each serialized object includes:
 * - schema_version: Version of the serialization schema
 * - engine_version: Version of the engine
 * - platform_version: Platform identifier
 * 
 * Includes backward/forward compatibility tests and replay invariants.
 */

// ─── Version Constants ───────────────────────────────────────────────────────

export const SERIALIZATION_SCHEMA_VERSION = 1;
export const ENGINE_VERSION = '1.0.0';
export const PLATFORM_VERSION = process.platform === 'win32' ? 'windows' 
  : process.platform === 'darwin' ? 'darwin' 
  : process.platform === 'linux' ? 'linux' 
  : 'unknown';

// ─── Common Headers ─────────────────────────────────────────────────────────

export interface SerializationHeader {
  schema_version: number;
  engine_version: string;
  platform_version: string;
  serialized_at: string;
}

// ─── Plan Serialization ─────────────────────────────────────────────────────

export interface Plan {
  id: string;
  steps: PlanStep[];
  metadata: Record<string, unknown>;
}

export interface PlanStep {
  id: string;
  action: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface SerializedPlan extends SerializationHeader {
  type: 'plan';
  data: Plan;
}

// ─── Execution Event Serialization ─────────────────────────────────────────

export type ExecutionEventType = 
  | 'execution_start'
  | 'execution_end'
  | 'tool_call'
  | 'tool_result'
  | 'policy_decision'
  | 'guardrail_check'
  | 'budget_check'
  | 'error';

export interface ExecutionEvent {
  type: ExecutionEventType;
  timestamp: string;
  seq: number;
  data: Record<string, unknown>;
}

export interface SerializedExecutionLog extends SerializationHeader {
  type: 'execution_log';
  execution_id: string;
  events: ExecutionEvent[];
}

// ─── Artifact Manifest Serialization ───────────────────────────────────────

export interface ArtifactManifest {
  id: string;
  artifacts: Artifact[];
  metadata: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  digest: string;
  size: number;
  encoding?: string;
}

export interface SerializedArtifactManifest extends SerializationHeader {
  type: 'artifact_manifest';
  data: ArtifactManifest;
}

// ─── Canonical Serialization Functions ──────────────────────────────────────

/**
 * Create a serialization header
 */
function createHeader(): SerializationHeader {
  return {
    schema_version: SERIALIZATION_SCHEMA_VERSION,
    engine_version: ENGINE_VERSION,
    platform_version: PLATFORM_VERSION,
    serialized_at: new Date().toISOString(),
  };
}

/**
 * Serialize a Plan to canonical JSON
 */
export function serializePlan(plan: Plan): string {
  const serialized: SerializedPlan = {
    ...createHeader(),
    type: 'plan',
    data: plan,
  };
  return canonicalStringify(serialized);
}

/**
 * Deserialize a Plan from JSON
 */
export function deserializePlan(json: string): Plan {
  const parsed = JSON.parse(json) as SerializedPlan;
  
  // Version compatibility check
  if (parsed.schema_version > SERIALIZATION_SCHEMA_VERSION) {
    throw new Error(`Cannot deserialize plan: schema version ${parsed.schema_version} is newer than supported ${SERIALIZATION_SCHEMA_VERSION}`);
  }
  
  // Handle backward compatibility
  return migratePlan(parsed);
}

/**
 * Serialize execution log to canonical JSON
 */
export function serializeExecutionLog(executionId: string, events: ExecutionEvent[]): string {
  const serialized: SerializedExecutionLog = {
    ...createHeader(),
    type: 'execution_log',
    execution_id: executionId,
    events,
  };
  return canonicalStringify(serialized);
}

/**
 * Deserialize execution log from JSON
 */
export function deserializeExecutionLog(json: string): { executionId: string; events: ExecutionEvent[] } {
  const parsed = JSON.parse(json) as SerializedExecutionLog;
  
  if (parsed.schema_version > SERIALIZATION_SCHEMA_VERSION) {
    throw new Error(`Cannot deserialize execution log: schema version ${parsed.schema_version} is newer than supported ${SERIALIZATION_SCHEMA_VERSION}`);
  }
  
  return {
    executionId: parsed.execution_id,
    events: parsed.events,
  };
}

/**
 * Serialize artifact manifest to canonical JSON
 */
export function serializeArtifactManifest(manifest: ArtifactManifest): string {
  const serialized: SerializedArtifactManifest = {
    ...createHeader(),
    type: 'artifact_manifest',
    data: manifest,
  };
  return canonicalStringify(serialized);
}

/**
 * Deserialize artifact manifest from JSON
 */
export function deserializeArtifactManifest(json: string): ArtifactManifest {
  const parsed = JSON.parse(json) as SerializedArtifactManifest;
  
  if (parsed.schema_version > SERIALIZATION_SCHEMA_VERSION) {
    throw new Error(`Cannot deserialize manifest: schema version ${parsed.schema_version} is newer than supported ${SERIALIZATION_SCHEMA_VERSION}`);
  }
  
  return parsed.data;
}

// ─── Canonical JSON Stringification ─────────────────────────────────────────

/**
 * Canonical JSON stringification - sorted keys, no whitespace
 * Follows the rules from determinism.contract.json
 */
export function canonicalStringify(obj: unknown): string {
  return canonicalStringifyInternal(obj);
}

function canonicalStringifyInternal(obj: unknown): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'null';
  
  if (typeof obj === 'boolean') return obj.toString();
  if (typeof obj === 'number') return canonicalNumberStringify(obj);
  if (typeof obj === 'string') return canonicalStringStringify(obj);
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '[' + obj.map(canonicalStringifyInternal).join(',') + ']';
  }
  
  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    if (keys.length === 0) return '{}';
    
    const pairs = keys.map(key => {
      const value = (obj as Record<string, unknown>)[key];
      return canonicalStringStringify(key) + ':' + canonicalStringifyInternal(value);
    });
    
    return '{' + pairs.join(',') + '}';
  }
  
  // Fallback
  return JSON.stringify(obj);
}

/**
 * Canonical number serialization
 * - Integers serialized as integers (no trailing .0)
 * - Floats with exactly 6 decimal places
 */
function canonicalNumberStringify(n: number): string {
  // Handle special cases
  if (!Number.isFinite(n)) {
    return 'null'; // NaN and Infinity become null
  }
  
  // Check if integer
  if (Number.isInteger(n)) {
    return n.toString();
  }
  
  // Float with exactly 6 decimal places
  return n.toFixed(6).replace(/\.?0+$/, '');
}

/**
 * Canonical string serialization
 * - UTF-8 encoded
 * - Escape sequences: \n \t \r \b \f \" \\
 * - No escaped Unicode code points
 */
function canonicalStringStringify(s: string): string {
  let result = '"';
  
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    const code = s.charCodeAt(i);
    
    // Handle escape sequences
    switch (char) {
      case '\n': result += '\\n'; break;
      case '\t': result += '\\t'; break;
      case '\r': result += '\\r'; break;
      case '\b': result += '\\b'; break;
      case '\f': result += '\\f'; break;
      case '"': result += '\\"'; break;
      case '\\': result += '\\\\'; break;
      default:
        // Only escape ASCII control characters
        if (code < 32) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += char;
        }
    }
  }
  
  result += '"';
  return result;
}

// ─── Migration Functions ───────────────────────────────────────────────────

/**
 * Migrate a serialized plan to current schema version
 */
function migratePlan(serialized: SerializedPlan): Plan {
  // Currently only schema version 1 exists
  // Add migration logic here for future versions
  return serialized.data;
}

// ─── Replay Invariants ─────────────────────────────────────────────────────

export interface ReplayInvariant {
  name: string;
  description: string;
  check: (original: unknown, replayed: unknown) => boolean;
}

/**
 * Common replay invariants
 */
export const REPLAY_INVARIANTS: ReplayInvariant[] = [
  {
    name: 'plan_digest',
    description: 'Plan digest must be identical across replay',
    check: (original, replayed) => {
      const o = original as SerializedPlan;
      const r = replayed as SerializedPlan;
      return canonicalStringify(o.data) === canonicalStringify(r.data);
    },
  },
  {
    name: 'execution_event_count',
    description: 'Number of execution events must match',
    check: (original, replayed) => {
      const o = original as SerializedExecutionLog;
      const r = replayed as SerializedExecutionLog;
      return o.events.length === r.events.length;
    },
  },
  {
    name: 'artifact_manifest_digest',
    description: 'Artifact manifest digest must be identical',
    check: (original, replayed) => {
      const o = original as SerializedArtifactManifest;
      const r = replayed as SerializedArtifactManifest;
      return canonicalStringify(o.data) === canonicalStringify(r.data);
    },
  },
];

/**
 * Verify replay invariants
 */
export function verifyReplayInvariant(
  invariant: ReplayInvariant,
  original: unknown,
  replayed: unknown
): { ok: boolean; error?: string } {
  try {
    const result = invariant.check(original, replayed);
    return { ok: result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Verify all replay invariants
 */
export function verifyAllReplays(
  original: SerializedPlan | SerializedExecutionLog | SerializedArtifactManifest,
  replayed: SerializedPlan | SerializedExecutionLog | SerializedArtifactManifest
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  
  for (const invariant of REPLAY_INVARIANTS) {
    const result = verifyReplayInvariant(invariant, original, replayed);
    if (!result.ok) {
      failures.push(`${invariant.name}: ${result.error || 'failed'}`);
    }
  }
  
  return { ok: failures.length === 0, failures };
}

// ─── Version Compatibility Tests ───────────────────────────────────────────

/**
 * Test backward compatibility
 */
export function testBackwardCompatibility(
  serializeFn: (obj: unknown) => string,
  deserializeFn: (json: string) => unknown,
  testCases: unknown[]
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  
  for (const testCase of testCases) {
    try {
      const serialized = serializeFn(testCase);
      const deserialized = deserializeFn(serialized);
      
      // Compare canonical forms
      const original = canonicalStringify(testCase);
      const restored = canonicalStringify(deserialized);
      
      if (original !== restored.push(`Canonical form) {
        failures mismatch for ${JSON.stringify(testCase).slice(0, 50)}`);
      }
    } catch (e) {
      failures.push(`Serialization error: ${(e as Error).message}`);
    }
  }
  
  return { ok: failures.length === 0, failures };
}

export default {
  SERIALIZATION_SCHEMA_VERSION,
  ENGINE_VERSION,
  PLATFORM_VERSION,
  serializePlan,
  deserializePlan,
  serializeExecutionLog,
  deserializeExecutionLog,
  serializeArtifactManifest,
  deserializeArtifactManifest,
  canonicalStringify,
  REPLAY_INVARIANTS,
  verifyReplayInvariant,
  verifyAllReplays,
  testBackwardCompatibility,
};
