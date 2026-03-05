import {
  applyRepairPlan,
  diffRunToolEvents,
  exportIncidentPack,
  getRunToolEvents,
  preflightTool,
} from '../../../ai/src/tools/failureRuntime.js';

function asJson(args: string[]): boolean { return args.includes('--json'); }

export async function runDiagnoseCommand(args: string[]): Promise<number> {
  const runId = args.find((arg) => !arg.startsWith('-'));
  if (!runId) {
    console.error('Usage: rq diagnose <run_id> [--json]');
    return 1;
  }
  const events = getRunToolEvents(runId);
  const output = {
    run_id: runId,
    events: events.map((event) => ({
      step_id: event.step_id,
      status: event.status,
      tool: event.tool_name,
      failure_class: event.failure_class ?? null,
      cause: event.diagnosis?.cause ?? null,
      next_action: event.repair_plan?.steps[0]?.instruction ?? null,
    })),
  };
  if (asJson(args)) {
    console.log(JSON.stringify(output, null, 2));
    return 0;
  }
  for (const event of output.events) {
    const icon = event.status === 'ok' ? '✓' : '✗';
    console.log(`${icon} ${event.step_id} ${event.tool} ${event.failure_class ?? 'ok'} ${event.cause ?? 'completed'} ${event.next_action ?? ''}`);
  }
  return 0;
}

export async function runDoctorRuntimeCommand(args: string[]): Promise<number> {
  const tool = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : 'system.echo';
  const report = preflightTool(tool || 'system.echo');
  if (asJson(args)) {
    console.log(JSON.stringify({ tool, ...report }, null, 2));
  } else {
    console.log(`${report.status} ${tool}: ${report.reason}`);
  }
  return report.status === 'FAIL' ? 1 : 0;
}

export async function runRepairCommand(args: string[]): Promise<number> {
  const runId = args.find((arg) => !arg.startsWith('-'));
  if (!runId) {
    console.error('Usage: rq repair <run_id> [--plan] [--apply] [--dry-run] [--json]');
    return 1;
  }
  const events = getRunToolEvents(runId);
  const latest = events[events.length - 1];
  const apply = args.includes('--apply') && !args.includes('--dry-run');
  const applyResult = applyRepairPlan(runId, apply);
  const payload = {
    run_id: runId,
    plan: latest?.repair_plan ?? null,
    apply: applyResult,
  };
  console.log(JSON.stringify(payload, null, 2));
  return 0;
}

export async function runToolDiffCommand(args: string[]): Promise<number> {
  const positional = args.filter((arg) => !arg.startsWith('-'));
  if (positional.length < 2) {
    console.error('Usage: rq diff <runA> <runB> [--json]');
    return 1;
  }
  const report = diffRunToolEvents(positional[0], positional[1]);
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

export async function runIncidentExportCommand(args: string[]): Promise<number> {
  const runId = args.find((arg) => !arg.startsWith('-'));
  if (!runId) {
    console.error('Usage: rq incident export <run_id>');
    return 1;
  }
  console.log(JSON.stringify(exportIncidentPack(runId), null, 2));
  return 0;
}
