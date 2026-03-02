/**
 * Tool Schema Lock (Differentiator A)
 *
 * Deterministic "Semantic Contract" for Tools — strict IO schema enforcement.
 * Binds JSON Schema snapshots to semantic states and detects schema drift.
 *
 * INVARIANT: Schema snapshots are content-derived (BLAKE3).
 * INVARIANT: Schema drift is a first-class drift category.
 * INVARIANT: No network required for verification.
 */

import { hash } from './hash.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SchemaSnapshotId = string & { __brand: 'SchemaSnapshotId' };

/**
 * JSON Schema definition for tool IO.
 */
export interface ToolSchema {
  /** Schema version */
  version: '1.0.0';
  /** Tool name this schema applies to */
  toolName: string;
  /** JSON Schema for input validation */
  inputSchema?: Record<string, unknown>;
  /** JSON Schema for output validation */
  outputSchema?: Record<string, unknown>;
  /** Schema metadata */
  metadata: {
    createdAt: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    examples?: any[];
  };
}

/**
 * Schema snapshot with computed ID.
 */
export interface SchemaSnapshot {
  /** Content-derived schema ID (BLAKE3 of canonical schema) */
  id: SchemaSnapshotId;
  /** The schema definition */
  schema: ToolSchema;
  /** Canonical string that was hashed */
  canonical: string;
}

/**
 * Tool-to-schema binding for a semantic state.
 */
export interface ToolSchemaBinding {
  /** Tool name */
  toolName: string;
  /** Schema snapshot ID at time of binding */
  schemaId: SchemaSnapshotId;
  /** When the binding was created */
  boundAt: string;
  /** State ID this binding is associated with */
  stateId?: string;
}

/**
 * Schema drift detection result.
 */
export interface SchemaDriftResult {
  /** Whether drift was detected */
  hasDrift: boolean;
  /** Type of drift */
  driftType: 'none' | 'input' | 'output' | 'both' | 'missing';
  /** Original schema snapshot */
  original?: SchemaSnapshot;
  /** Current schema snapshot */
  current?: SchemaSnapshot;
  /** Human-readable explanation */
  explanation: string;
  /** Compatibility assessment */
  compatibility: 'compatible' | 'breaking' | 'unknown';
}

/**
 * Schema validation result.
 */
export interface SchemaValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Tool name */
  toolName: string;
  /** Validation errors */
  errors: SchemaValidationError[];
  /** Schema ID used for validation */
  schemaId?: SchemaSnapshotId;
}

export interface SchemaValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA SNAPSHOT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const SCHEMA_DIR = join(process.cwd(), '.reach', 'tool-schemas');

function ensureSchemaDir(): void {
  if (!existsSync(SCHEMA_DIR)) {
    mkdirSync(SCHEMA_DIR, { recursive: true });
  }
}

function getSchemaPath(schemaId: SchemaSnapshotId): string {
  return join(SCHEMA_DIR, `${schemaId}.json`);
}

/**
 * Compute canonical representation for deterministic hashing.
 */
function canonicalizeSchema(schema: ToolSchema): string {
  // Sort keys for determinism
  return JSON.stringify(schema, Object.keys(schema).sort());
}

/**
 * Compute schema snapshot ID (BLAKE3 hash).
 */
export function computeSchemaId(schema: ToolSchema): SchemaSnapshotId {
  const canonical = canonicalizeSchema(schema);
  return hash(canonical) as SchemaSnapshotId;
}

/**
 * Create a schema snapshot from a schema definition.
 */
export function createSchemaSnapshot(schema: ToolSchema): SchemaSnapshot {
  const canonical = canonicalizeSchema(schema);
  const id = hash(canonical) as SchemaSnapshotId;

  return {
    id,
    schema,
    canonical,
  };
}

/**
 * Save a schema snapshot to storage.
 */
export function saveSchemaSnapshot(snapshot: SchemaSnapshot): void {
  ensureSchemaDir();
  writeFileSync(getSchemaPath(snapshot.id), JSON.stringify(snapshot, null, 2));
}

/**
 * Load a schema snapshot by ID.
 */
export function loadSchemaSnapshot(id: SchemaSnapshotId): SchemaSnapshot | null {
  const path = getSchemaPath(id);
  if (!existsSync(path)) return null;

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as SchemaSnapshot;
  } catch {
    return null;
  }
}

/**
 * List all stored schema snapshots.
 */
export function listSchemaSnapshots(): SchemaSnapshotId[] {
  if (!existsSync(SCHEMA_DIR)) return [];
  const files = require('fs').readdirSync(SCHEMA_DIR) as string[];
  return files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) as SchemaSnapshotId[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA BINDINGS
// ═══════════════════════════════════════════════════════════════════════════════

const BINDINGS_FILE = join(process.cwd(), '.reach', 'tool-schema-bindings.json');

interface BindingsStore {
  version: '1.0.0';
  bindings: ToolSchemaBinding[];
}

function loadBindingsStore(): BindingsStore {
  if (!existsSync(BINDINGS_FILE)) {
    return { version: '1.0.0', bindings: [] };
  }

  try {
    return JSON.parse(readFileSync(BINDINGS_FILE, 'utf-8')) as BindingsStore;
  } catch {
    return { version: '1.0.0', bindings: [] };
  }
}

function saveBindingsStore(store: BindingsStore): void {
  writeFileSync(BINDINGS_FILE, JSON.stringify(store, null, 2));
}

/**
 * Bind a tool schema to a semantic state.
 */
export function bindToolSchema(
  toolName: string,
  schemaSnapshotId: SchemaSnapshotId,
  stateId?: string
): ToolSchemaBinding {
  const binding: ToolSchemaBinding = {
    toolName,
    schemaId: schemaSnapshotId,
    boundAt: new Date().toISOString(),
    stateId,
  };

  const store = loadBindingsStore();
  // Remove any existing binding for this tool+state combo
  store.bindings = store.bindings.filter(b =>
    !(b.toolName === toolName && b.stateId === stateId)
  );
  store.bindings.push(binding);
  saveBindingsStore(store);

  return binding;
}

/**
 * Get the schema binding for a tool (optionally at a specific state).
 */
export function getToolSchemaBinding(
  toolName: string,
  stateId?: string
): ToolSchemaBinding | undefined {
  const store = loadBindingsStore();

  // First try exact match with state
  let binding = store.bindings.find(b => b.toolName === toolName && b.stateId === stateId);

  // Fall back to unbound (global) binding
  if (!binding) {
    binding = store.bindings.find(b => b.toolName === toolName && !b.stateId);
  }

  return binding;
}

/**
 * List all bindings, optionally filtered by state.
 */
export function listToolBindings(stateId?: string): ToolSchemaBinding[] {
  const store = loadBindingsStore();

  if (stateId) {
    return store.bindings.filter(b => b.stateId === stateId || !b.stateId);
  }

  return store.bindings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA DRIFT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect drift between a bound schema and a current schema.
 */
export function detectSchemaDrift(
  toolName: string,
  currentSchema: ToolSchema,
  boundSchemaId?: SchemaSnapshotId
): SchemaDriftResult {
  // If no binding, we can't detect drift
  if (!boundSchemaId) {
    return {
      hasDrift: false,
      driftType: 'missing',
      explanation: `No schema binding found for tool "${toolName}"`,
      compatibility: 'unknown',
    };
  }

  const boundSnapshot = loadSchemaSnapshot(boundSchemaId);
  if (!boundSnapshot) {
    return {
      hasDrift: true,
      driftType: 'missing',
      explanation: `Bound schema ${boundSchemaId.substring(0, 16)}... not found in storage`,
      compatibility: 'unknown',
    };
  }

  const currentSnapshot = createSchemaSnapshot(currentSchema);

  // Compare IDs
  if (boundSnapshot.id === currentSnapshot.id) {
    return {
      hasDrift: false,
      driftType: 'none',
      original: boundSnapshot,
      current: currentSnapshot,
      explanation: `Schema for "${toolName}" matches binding (no drift)`,
      compatibility: 'compatible',
    };
  }

  // Analyze what changed
  const bound = boundSnapshot.schema;
  let inputChanged = false;
  let outputChanged = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let breaking = false;

  // Compare input schemas
  const boundInput = canonicalizeSchema(bound.inputSchema as unknown as ToolSchema);
  const currentInput = canonicalizeSchema(currentSchema.inputSchema as unknown as ToolSchema);
  if (boundInput !== currentInput) {
    inputChanged = true;
    // Simple heuristic: required field changes are breaking
    breaking = detectBreakingChange(bound.inputSchema, currentSchema.inputSchema);
  }

  // Compare output schemas
  const boundOutput = canonicalizeSchema(bound.outputSchema as unknown as ToolSchema);
  const currentOutput = canonicalizeSchema(currentSchema.outputSchema as unknown as ToolSchema);
  if (boundOutput !== currentOutput) {
    outputChanged = true;
  }

  let driftType: SchemaDriftResult['driftType'];
  if (inputChanged && outputChanged) driftType = 'both';
  else if (inputChanged) driftType = 'input';
  else if (outputChanged) driftType = 'output';
  else driftType = 'none';

  const compatibility: SchemaDriftResult['compatibility'] = breaking ? 'breaking' : 'compatible';

  return {
    hasDrift: true,
    driftType,
    original: boundSnapshot,
    current: currentSnapshot,
    explanation: `Schema drift detected for "${toolName}": ${driftType} schema changed. ` +
      `Bound: ${boundSnapshot.id.substring(0, 16)}..., Current: ${currentSnapshot.id.substring(0, 16)}...`,
    compatibility,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectBreakingChange(oldSchema?: Record<string, any>, newSchema?: Record<string, any>): boolean {
  if (!oldSchema || !newSchema) return true;

  // Simple heuristic: if required fields changed, it's breaking
  const oldRequired = new Set(Array.isArray(oldSchema.required) ? oldSchema.required : []);
  const newRequired = new Set(Array.isArray(newSchema.required) ? newSchema.required : []);

  // Added required fields = breaking
  for (const field of newRequired) {
    if (!oldRequired.has(field)) return true;
  }

  // Removed properties = breaking
  const oldProps = Object.keys(oldSchema.properties || {});
  const newProps = Object.keys(newSchema.properties || {});
  for (const prop of oldProps) {
    if (!newProps.includes(prop)) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA VALIDATION (SIMPLE IMPLEMENTATION)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple JSON Schema validation (subset of JSON Schema Draft 7).
 * Full validation would use ajv or similar, but we avoid heavy deps.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateAgainstSchema(data: unknown, schema?: Record<string, any>): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  if (!schema) {
    return errors; // No schema = no validation
  }

  // Type validation
  if (schema.type) {
    const actualType = getJsonType(data);
    if (Array.isArray(schema.type)) {
      if (!schema.type.includes(actualType)) {
        errors.push({
          path: '',
          message: `Expected type ${schema.type.join(' or ')}, got ${actualType}`,
          severity: 'error',
        });
      }
    } else if (actualType !== schema.type) {
      errors.push({
        path: '',
        message: `Expected type ${schema.type}, got ${actualType}`,
        severity: 'error',
      });
    }
  }

  // Object property validation
  if (schema.type === 'object' && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Required fields
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push({
            path: field,
            message: `Required field "${field}" is missing`,
            severity: 'error',
          });
        }
      }
    }

    // Property schemas
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propErrors = validateAgainstSchema(obj[key], propSchema as Record<string, unknown>);
          errors.push(...propErrors.map(e => ({
            path: e.path ? `${key}.${e.path}` : key,
            message: e.message,
            severity: e.severity,
          })));
        }
      }
    }
  }

  // Array validation
  if (schema.type === 'array' && Array.isArray(data)) {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      errors.push({
        path: '',
        message: `Array must have at least ${schema.minItems} items`,
        severity: 'error',
      });
    }
    if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) {
      errors.push({
        path: '',
        message: `Array must have at most ${schema.maxItems} items`,
        severity: 'error',
      });
    }
  }

  // Enum validation
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      errors.push({
        path: '',
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        severity: 'error',
      });
    }
  }

  return errors;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Validate tool input/output against its bound schema.
 */
export function validateToolIO(
  toolName: string,
  input?: unknown,
  output?: unknown,
  stateId?: string
): SchemaValidationResult {
  const binding = getToolSchemaBinding(toolName, stateId);
  const errors: SchemaValidationError[] = [];

  if (!binding) {
    return {
      valid: true, // No binding = no validation required
      toolName,
      errors: [],
    };
  }

  const snapshot = loadSchemaSnapshot(binding.schemaId);
  if (!snapshot) {
    return {
      valid: false,
      toolName,
      errors: [{
        path: '',
        message: `Schema snapshot ${binding.schemaId.substring(0, 16)}... not found`,
        severity: 'error',
      }],
      schemaId: binding.schemaId,
    };
  }

  // Validate input
  if (input !== undefined && snapshot.schema.inputSchema) {
    const inputErrors = validateAgainstSchema(input, snapshot.schema.inputSchema);
    errors.push(...inputErrors.map(e => ({ ...e, path: `input${e.path ? '.' + e.path : ''}` })));
  }

  // Validate output
  if (output !== undefined && snapshot.schema.outputSchema) {
    const outputErrors = validateAgainstSchema(output, snapshot.schema.outputSchema);
    errors.push(...outputErrors.map(e => ({ ...e, path: `output${e.path ? '.' + e.path : ''}` })));
  }

  return {
    valid: errors.length === 0,
    toolName,
    errors,
    schemaId: binding.schemaId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA GENERATION FROM EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a simple JSON Schema from example values.
 * Useful for bootstrapping schema definitions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateSchemaFromExamples(examples: unknown[], toolName: string): ToolSchema {
  if (examples.length === 0) {
    return {
      version: '1.0.0',
      toolName,
      metadata: {
        createdAt: new Date().toISOString(),
        description: `Generated schema for ${toolName}`,
      },
    };
  }

  // Infer type from first example
  const firstExample = examples[0];
  const inferredType = getJsonType(firstExample);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let schema: Record<string, any> = { type: inferredType };

  if (inferredType === 'object' && typeof firstExample === 'object' && firstExample !== null) {
    const obj = firstExample as Record<string, unknown>;
    schema.properties = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema.required = [] as any[];

    for (const [key, value] of Object.entries(obj)) {
      schema.properties[key] = { type: getJsonType(value) };
      schema.required.push(key);
    }
  }

  return {
    version: '1.0.0',
    toolName,
    inputSchema: schema,
    metadata: {
      createdAt: new Date().toISOString(),
      description: `Generated schema for ${toolName} from ${examples.length} example(s)`,
      examples: examples.slice(0, 3),
    },
  };
}
