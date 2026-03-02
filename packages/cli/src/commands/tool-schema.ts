/**
 * @fileoverview Tool-schema command — Tool IO Schema Lock
 *
 * Commands:
 *   reach tool-schema lock <tool>       Lock current tool schema to state
 *   reach tool-schema verify <tool>     Verify tool input/output against schema
 *   reach tool-schema drift <tool>      Detect schema drift
 *   reach tool-schema list              List locked schemas
 *   reach tool-schema show <id>         Show schema details
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: Schema snapshots are BLAKE3-hashed.
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import {
  getDefaultSSMStore,
  type SemanticStateId,
} from '../lib/semantic-state-machine.js';
import {
  createSchemaSnapshot,
  saveSchemaSnapshot,
  loadSchemaSnapshot,
  listSchemaSnapshots,
  bindToolSchema,
  getToolSchemaBinding,
  listToolBindings,
  detectSchemaDrift,
  validateToolIO,
  generateSchemaFromExamples,
  type ToolSchema,
} from '../lib/tool-schema-lock.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createToolSchemaCommand(): Command {
  const toolSchemaCmd = new Command('tool-schema')
    .description('Tool IO Schema Lock — semantic contracts for tool IO')
    .option('--json', 'Output in JSON format');

  // Lock command
  toolSchemaCmd
    .command('lock')
    .description('Lock tool schema to current or specified semantic state')
    .argument('<tool-name>', 'Tool name to lock')
    .option('--state <id>', 'State ID to bind schema to')
    .option('--schema <file>', 'Path to JSON schema file')
    .option('--generate', 'Generate schema from built-in examples')
    .action((toolName, options) => {
      try {
        let schema: ToolSchema;

        if (options.schema) {
          // Load schema from file
          const content = readFileSync(options.schema, 'utf-8');
          const parsed = JSON.parse(content);
          schema = {
            version: '1.0.0',
            toolName,
            inputSchema: parsed.inputSchema,
            outputSchema: parsed.outputSchema,
            metadata: {
              createdAt: new Date().toISOString(),
              description: parsed.description || `Schema for ${toolName}`,
            },
          };
        } else if (options.generate) {
          // Generate from examples (placeholder - would need example store)
          schema = generateSchemaFromExamples([{ message: 'string' }], toolName);
        } else {
          // Create permissive schema as placeholder
          schema = {
            version: '1.0.0',
            toolName,
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' },
            metadata: {
              createdAt: new Date().toISOString(),
              description: `Permissive schema for ${toolName}`,
            },
          };
        }

        // Create and save snapshot
        const snapshot = createSchemaSnapshot(schema);
        saveSchemaSnapshot(snapshot);

        // Bind to state if specified
        let stateId: string | undefined;
        if (options.state) {
          const store = getDefaultSSMStore();
          const allStates = store.listStates();
          const state = store.getState(options.state as SemanticStateId) ||
            allStates.find(s => s.id.startsWith(options.state));

          if (!state) {
            handleError(`State not found: ${options.state}`, options.parent?.json);
            return;
          }
          stateId = state.id;
        }

        bindToolSchema(toolName, snapshot.id, stateId);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            success: true,
            tool: toolName,
            schemaId: snapshot.id,
            stateId,
            boundAt: new Date().toISOString(),
          }) + '\n');
        } else {
          process.stdout.write(`Locked schema for "${toolName}"\n`);
          process.stdout.write(`Schema ID: ${snapshot.id.substring(0, 16)}...\n`);
          if (stateId) {
            process.stdout.write(`Bound to state: ${stateId.substring(0, 16)}...\n`);
          }
        }
        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Verify command
  toolSchemaCmd
    .command('verify')
    .description('Verify tool input/output against locked schema')
    .argument('<tool-name>', 'Tool name to verify')
    .option('--input <file>', 'Input JSON file to validate')
    .option('--output <file>', 'Output JSON file to validate')
    .option('--state <id>', 'Use schema bound to specific state')
    .action((toolName, options) => {
      try {
        // Load input/output if provided
        let input: unknown;
        let output: unknown;

        if (options.input) {
          input = JSON.parse(readFileSync(options.input, 'utf-8'));
        }
        if (options.output) {
          output = JSON.parse(readFileSync(options.output, 'utf-8'));
        }

        const result = validateToolIO(toolName, input, output, options.state);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            valid: result.valid,
            tool: toolName,
            schemaId: result.schemaId,
            errors: result.errors,
          }, null, 2) + '\n');
        } else {
          if (result.valid) {
            process.stdout.write(`✓ "${toolName}" IO is valid`);
            if (result.schemaId) {
              process.stdout.write(` against schema ${result.schemaId.substring(0, 16)}...`);
            }
            process.stdout.write('\n');
          } else {
            process.stdout.write(`✗ "${toolName}" IO validation failed:\n`);
            for (const error of result.errors) {
              process.stdout.write(`  [${error.severity}] ${error.path}: ${error.message}\n`);
            }
          }
        }

        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Drift command
  toolSchemaCmd
    .command('drift')
    .description('Detect schema drift for a tool')
    .argument('<tool-name>', 'Tool name to check')
    .option('--current <file>', 'Current schema file to compare against')
    .option('--state <id>', 'Use schema bound to specific state')
    .action((toolName, options) => {
      try {
        const binding = getToolSchemaBinding(toolName, options.state);

        if (!binding && !options.current) {
          handleError(`No schema binding found for "${toolName}"`, options.parent?.json);
          return;
        }

        let currentSchema: ToolSchema;
        if (options.current) {
          const content = readFileSync(options.current, 'utf-8');
          const parsed = JSON.parse(content);
          currentSchema = {
            version: '1.0.0',
            toolName,
            inputSchema: parsed.inputSchema,
            outputSchema: parsed.outputSchema,
            metadata: {
              createdAt: new Date().toISOString(),
              description: parsed.description || `Current schema for ${toolName}`,
            },
          };
        } else {
          // Load from binding
          const snapshot = binding ? loadSchemaSnapshot(binding.schemaId) : null;
          if (!snapshot) {
            handleError(`Schema snapshot not found`, options.parent?.json);
            return;
          }
          currentSchema = snapshot.schema;
        }

        const result = detectSchemaDrift(toolName, currentSchema, binding?.schemaId);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            hasDrift: result.hasDrift,
            driftType: result.driftType,
            compatibility: result.compatibility,
            explanation: result.explanation,
            originalId: result.original?.id,
            currentId: result.current?.id,
          }, null, 2) + '\n');
        } else {
          process.stdout.write(result.explanation + '\n');
          if (result.hasDrift) {
            process.stdout.write(`Compatibility: ${result.compatibility}\n`);
            if (result.original && result.current) {
              process.stdout.write(`Original: ${result.original.id.substring(0, 16)}...\n`);
              process.stdout.write(`Current:  ${result.current.id.substring(0, 16)}...\n`);
            }
          }
        }

        process.exit(result.hasDrift ? 1 : 0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // List command
  toolSchemaCmd
    .command('list')
    .description('List locked tool schemas')
    .option('--tool <name>', 'Filter by tool name')
    .option('--state <id>', 'Filter by state binding')
    .action((options) => {
      try {
        const schemaIds = listSchemaSnapshots();
        const bindings = listToolBindings(options.state);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            schemas: schemaIds.map(id => ({
              id,
              shortId: id.substring(0, 16),
            })),
            bindings: bindings.map(b => ({
              toolName: b.toolName,
              schemaId: b.schemaId,
              shortSchemaId: b.schemaId.substring(0, 16),
              stateId: b.stateId,
              boundAt: b.boundAt,
            })),
          }, null, 2) + '\n');
        } else {
          process.stdout.write('Schema Snapshots:\n');
          for (const id of schemaIds.slice(0, 20)) {
            process.stdout.write(`  ${id.substring(0, 16)}...\n`);
          }
          if (schemaIds.length > 20) {
            process.stdout.write(`  ... and ${schemaIds.length - 20} more\n`);
          }

          process.stdout.write('\nActive Bindings:\n');
          for (const b of bindings) {
            const stateInfo = b.stateId ? ` [state: ${b.stateId.substring(0, 8)}...]` : ' [global]';
            process.stdout.write(`  ${b.toolName}: ${b.schemaId.substring(0, 16)}...${stateInfo}\n`);
          }
        }
        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Show command
  toolSchemaCmd
    .command('show')
    .description('Show schema details')
    .argument('<schema-id>', 'Schema snapshot ID (full or prefix)')
    .action((schemaIdArg, options) => {
      try {
        // Find by full ID or prefix
        let schemaId = schemaIdArg;
        const allIds = listSchemaSnapshots();
        if (!allIds.includes(schemaIdArg)) {
          const match = allIds.find(id => id.startsWith(schemaIdArg));
          if (match) {
            schemaId = match;
          } else {
            handleError(`Schema not found: ${schemaIdArg}`, options.parent?.json);
            return;
          }
        }

        const snapshot = loadSchemaSnapshot(schemaId as import('../lib/tool-schema-lock.js').SchemaSnapshotId);
        if (!snapshot) {
          handleError(`Schema not found: ${schemaId}`, options.parent?.json);
          return;
        }

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            id: snapshot.id,
            schema: snapshot.schema,
            canonical: snapshot.canonical,
          }, null, 2) + '\n');
        } else {
          process.stdout.write(`Schema: ${snapshot.schema.toolName}\n`);
          process.stdout.write(`ID: ${snapshot.id}\n`);
          process.stdout.write(`Created: ${snapshot.schema.metadata.createdAt}\n`);
          if (snapshot.schema.metadata.description) {
            process.stdout.write(`Description: ${snapshot.schema.metadata.description}\n`);
          }
          if (snapshot.schema.inputSchema) {
            process.stdout.write('\nInput Schema:\n');
            process.stdout.write(JSON.stringify(snapshot.schema.inputSchema, null, 2) + '\n');
          }
          if (snapshot.schema.outputSchema) {
            process.stdout.write('\nOutput Schema:\n');
            process.stdout.write(JSON.stringify(snapshot.schema.outputSchema, null, 2) + '\n');
          }
        }
        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  return toolSchemaCmd;
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
export default createToolSchemaCommand;
