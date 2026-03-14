import { stableSortKeys } from '../core/cli-helpers.js';
import {
  clusterStatus,
  enqueueWorkflow,
  inspectWorkflow,
  installPlugin,
  listPlugins,
  listWorkflows,
  runWorkflow,
  setPluginEnabled,
  workerStart,
  workerStatus,
} from '../lib/workflow-platform.js';

function print(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(stableSortKeys(payload), null, 2)}\n`);
}

function parseInput(args: string[]): Record<string, unknown> {
  const inputFlag = args.find(a => a.startsWith('--input='));
  if (!inputFlag) return {};
  return JSON.parse(inputFlag.slice('--input='.length)) as Record<string, unknown>;
}

export async function runWorkflowPlatformCommand(command: string, args: string[]): Promise<number> {
  switch (command) {
    case 'workflow:list':
      print({ workflows: listWorkflows() });
      return 0;
    case 'workflow:inspect': {
      const name = args[0];
      if (!name) throw new Error('Usage: requiem workflow:inspect <workflow>');
      print({ workflow: inspectWorkflow(name) });
      return 0;
    }
    case 'workflow:run': {
      const name = args[0];
      if (!name) throw new Error('Usage: requiem workflow:run <workflow> [--input={...}]');
      const input = parseInput(args.slice(1));
      const run = runWorkflow(name, input);
      print({ run });
      return 0;
    }
    case 'workflow:enqueue': {
      const name = args[0];
      if (!name) throw new Error('Usage: requiem workflow:enqueue <workflow> [--input={...}]');
      const task = enqueueWorkflow(name, parseInput(args.slice(1)));
      print({ task });
      return 0;
    }
    case 'plugin:list':
      print({ plugins: listPlugins() });
      return 0;
    case 'plugin:install': {
      const src = args[0];
      if (!src) throw new Error('Usage: requiem plugin:install <path>');
      print(installPlugin(src));
      return 0;
    }
    case 'plugin:enable': {
      const name = args[0];
      if (!name) throw new Error('Usage: requiem plugin:enable <name>');
      print(setPluginEnabled(name, true));
      return 0;
    }
    case 'plugin:disable': {
      const name = args[0];
      if (!name) throw new Error('Usage: requiem plugin:disable <name>');
      print(setPluginEnabled(name, false));
      return 0;
    }
    case 'worker:start': {
      const workerId = args[0] ?? 'worker-local';
      const once = !args.includes('--drain');
      print(workerStart(workerId, once));
      return 0;
    }
    case 'worker:status':
      print({ workers: workerStatus() });
      return 0;
    case 'cluster:status':
      print({ cluster: clusterStatus() });
      return 0;
    default:
      return 1;
  }
}
