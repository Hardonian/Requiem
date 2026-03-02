/**
 * @fileoverview Budget command — Change Budget Governance
 *
 * Commands:
 *   reach budget define [options]       Define a new change budget
 *   reach budget check <from> <to>      Check if transition is within budget
 *   reach budget list                   List available budget presets
 *   reach budget show <name>            Show budget rules
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: Fail-closed (no budget = no approval).
 */

import { Command } from 'commander';
// fs imports are used for budget file storage - following existing CLI patterns
import { join } from 'path';
import {
  getDefaultSSMStore,
  type SemanticState,
  type SemanticStateId,
  DriftCategory as DriftCategoryValue,
} from '../lib/semantic-state-machine.js';
import {
  createPermissiveBudget,
  createStrictBudget,
  createProductionBudget,
  createCustomBudget,
  checkChangeBudget,
  serializeBudget,
  deserializeBudget,
  type ChangeBudget,
  type SignificanceLevel,
} from '../lib/change-budget.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const BUDGET_DIR = join(process.cwd(), '.reach', 'budgets');

function ensureBudgetDir(): void {
  if (!existsSync(BUDGET_DIR)) {
    mkdirSync(BUDGET_DIR, { recursive: true });
  }
}

function getBudgetPath(name: string): string {
  return join(BUDGET_DIR, `${name}.json`);
}

function saveBudget(budget: ChangeBudget): void {
  ensureBudgetDir();
  writeFileSync(getBudgetPath(budget.name), serializeBudget(budget));
}

function loadBudget(name: string): ChangeBudget | null {
  const path = getBudgetPath(name);
  if (!existsSync(path)) return null;
  try {
    return deserializeBudget(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function listBudgets(): string[] {
  if (!existsSync(BUDGET_DIR)) return [];
  const files = require('fs').readdirSync(BUDGET_DIR) as string[];
  return files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createBudgetCommand(): Command {
  const budgetCmd = new Command('budget')
    .description('Change Budget Governance — semantic diff budgets')
    .option('--json', 'Output in JSON format');

  // List available presets and saved budgets
  budgetCmd
    .command('list')
    .description('List available budget presets and saved budgets')
    .action((options) => {
      try {
        const presets = ['permissive', 'strict', 'production'];
        const saved = listBudgets();

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            presets,
            saved,
          }) + '\n');
        } else {
          process.stdout.write('Available Budget Presets:\n');
          for (const preset of presets) {
            process.stdout.write(`  • ${preset}\n`);
          }
          if (saved.length > 0) {
            process.stdout.write('\nSaved Budgets:\n');
            for (const name of saved) {
              process.stdout.write(`  • ${name}\n`);
            }
          }
        }
        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Define a new budget
  budgetCmd
    .command('define')
    .description('Define a new change budget')
    .requiredOption('--name <name>', 'Budget name')
    .option('--preset <preset>', 'Base on preset (permissive|strict|production)', 'permissive')
    .option('--model-drift <level>', 'Max allowed model drift (critical|major|minor|cosmetic|none)', 'critical')
    .option('--prompt-drift <level>', 'Max allowed prompt drift', 'major')
    .option('--policy-drift <level>', 'Max allowed policy drift', 'major')
    .option('--context-drift <level>', 'Max allowed context drift', 'minor')
    .option('--runtime-drift <level>', 'Max allowed runtime drift', 'cosmetic')
    .option('--model-approval', 'Require approval for model drift')
    .option('--prompt-approval', 'Require approval for prompt drift')
    .option('--policy-approval', 'Require approval for policy drift')
    .action((options) => {
      try {
        // Build custom rules from options
        const rules: { category: DriftCategory; maxSignificance: SignificanceLevel | 'none'; requiresApproval: boolean }[] = [];

        if (options.modelDrift) {
          rules.push({
            category: DriftCategory.ModelDrift,
            maxSignificance: options.modelDrift,
            requiresApproval: options.modelApproval || false,
          });
        }

        if (options.promptDrift) {
          rules.push({
            category: DriftCategory.PromptDrift,
            maxSignificance: options.promptDrift,
            requiresApproval: options.promptApproval || false,
          });
        }

        if (options.policyDrift) {
          rules.push({
            category: DriftCategory.PolicyDrift,
            maxSignificance: options.policyDrift,
            requiresApproval: options.policyApproval || false,
          });
        }

        if (options.contextDrift) {
          rules.push({
            category: DriftCategory.ContextDrift,
            maxSignificance: options.contextDrift,
            requiresApproval: false,
          });
        }

        if (options.runtimeDrift) {
          rules.push({
            category: DriftCategory.RuntimeDrift,
            maxSignificance: options.runtimeDrift,
            requiresApproval: false,
          });
        }

        const budget = createCustomBudget(
          options.name,
          rules,
          'major' // default
        );

        saveBudget(budget);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            success: true,
            budget: {
              name: budget.name,
              rules: rules.length,
              path: getBudgetPath(options.name),
            },
          }) + '\n');
        } else {
          process.stdout.write(`Created budget "${options.name}" with ${rules.length} rules\n`);
          process.stdout.write(`Saved to: ${getBudgetPath(options.name)}\n`);
        }
        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Check if a transition is within budget
  budgetCmd
    .command('check')
    .description('Check if transition from state A to state B is within budget')
    .argument('<from-id>', 'Source state ID (or "genesis")')
    .argument('<to-id>', 'Target state ID')
    .requiredOption('--budget <name>', 'Budget name to check against')
    .option('--strict', 'Exit with error if approval required')
    .action((fromIdArg, toIdArg, options) => {
      try {
        const store = getDefaultSSMStore();
        const allStates = store.listStates();

        // Load budget
        let budget = loadBudget(options.budget);
        if (!budget) {
          // Try to use preset
          switch (options.budget) {
            case 'permissive':
              budget = createPermissiveBudget('permissive');
              break;
            case 'strict':
              budget = createStrictBudget('strict');
              break;
            case 'production':
              budget = createProductionBudget('production');
              break;
            default:
              handleError(`Budget not found: ${options.budget}`, options.parent?.json);
              return;
          }
        }

        // Find states
        let fromState: SemanticState | null = null;
        if (fromIdArg.toLowerCase() !== 'genesis') {
          fromState = store.getState(fromIdArg as SemanticStateId) ||
            allStates.find(s => s.id.startsWith(fromIdArg)) ||
            null;

          if (!fromState) {
            handleError(`Source state not found: ${fromIdArg}`, options.parent?.json);
            return;
          }
        }

        const toState = store.getState(toIdArg as SemanticStateId) ||
          allStates.find(s => s.id.startsWith(toIdArg));

        if (!toState) {
          handleError(`Target state not found: ${toIdArg}`, options.parent?.json);
          return;
        }

        // Check budget
        const result = checkChangeBudget(budget, fromState, toState);

        if (options.parent?.json) {
          process.stdout.write(JSON.stringify({
            withinBudget: result.withinBudget,
            budget: options.budget,
            from: fromIdArg,
            to: toIdArg,
            summary: result.summary,
            categoryResults: result.categoryResults.map(r => ({
              category: r.category,
              significance: r.significance,
              allowed: r.allowed,
              requiresApproval: r.requiresApproval,
              message: r.message,
            })),
            explanation: result.explanation,
          }, null, 2) + '\n');
        } else {
          process.stdout.write(result.explanation + '\n\n');
          process.stdout.write(`Summary: ${result.summary.allowedChanges}/${result.summary.totalChanges} allowed`);
          if (result.summary.needsApproval > 0) {
            process.stdout.write(`, ${result.summary.needsApproval} need approval`);
          }
          if (result.summary.blockedChanges > 0) {
            process.stdout.write(`, ${result.summary.blockedChanges} blocked`);
          }
          process.stdout.write('\n');
        }

        // Exit codes: 0 = within budget, 1 = exceeds budget, 2 = approval required (if --strict)
        if (!result.withinBudget) {
          process.exit(1);
        } else if (options.strict && result.summary.needsApproval > 0) {
          process.exit(2);
        } else {
          process.exit(0);
        }
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  // Show budget details
  budgetCmd
    .command('show')
    .description('Show budget rules')
    .argument('<name>', 'Budget name')
    .action((name, options) => {
      try {
        let budget = loadBudget(name);
        if (!budget) {
          // Try presets
          switch (name) {
            case 'permissive':
              budget = createPermissiveBudget('permissive');
              break;
            case 'strict':
              budget = createStrictBudget('strict');
              break;
            case 'production':
              budget = createProductionBudget('production');
              break;
            default:
              handleError(`Budget not found: ${name}`, options.parent?.json);
              return;
          }
        }

        if (options.parent?.json) {
          process.stdout.write(serializeBudget(budget) + '\n');
        } else {
          process.stdout.write(`Budget: ${budget.name}\n`);
          process.stdout.write(`Version: ${budget.version}\n`);
          process.stdout.write(`Created: ${budget.createdAt}\n\n`);

          if (budget.rules.size > 0) {
            process.stdout.write('Rules:\n');
            for (const [category, rule] of budget.rules) {
              const maxSig = rule.maxSignificance ?? 'NONE';
              const approval = rule.requiresApproval ? ' [requires approval]' : '';
              process.stdout.write(`  • ${category}: max ${maxSig}${approval}\n`);
            }
          } else {
            process.stdout.write('Rules: (none - using defaults)\n');
          }

          process.stdout.write(`\nDefault: max ${budget.defaultRule.maxSignificance ?? 'NONE'}`);
          if (budget.defaultRule.requiresApproval) {
            process.stdout.write(' [requires approval]');
          }
          process.stdout.write('\n');
        }
        process.exit(0);
      } catch (error) {
        handleError(error, options.parent?.json);
      }
    });

  return budgetCmd;
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
export default createBudgetCommand;
