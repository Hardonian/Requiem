import {
  applyRepairPlan,
  decidePermission,
  diffRunToolEvents,
  exportIncidentPack,
  getFailurePatternStats,
  getRunToolEvents,
  importIncidentPack,
  listAdapters,
  listPermissionRequests,
  preflightTool,
  replayIncidentPack,
  runRuntimeDemo,
} from '../../../ai/src/tools/failureRuntime.js';
import { writeFileSync } from 'fs';

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
      prompt_repair_suggestion: event.failure_class === 'planning_error' || event.failure_class === 'interface_error' ? 'Run rq repair <run_id> --plan to review prompt fixes.' : null,
      next_action: event.repair_plan?.steps[0]?.instruction ?? null,
    })),
  };
  console.log(JSON.stringify(output, null, 2));
  return 0;
}

export async function runDoctorRuntimeCommand(args: string[]): Promise<number> {
  const tool = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : 'system.echo';
  const mode = args.includes('--strict') ? 'strict' : args.includes('--off') ? 'off' : 'warn';
  const report = preflightTool(tool || 'system.echo', mode);
  if (asJson(args)) {
    console.log(JSON.stringify({ tool, mode, adapters: listAdapters(), ...report }, null, 2));
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
  console.log(JSON.stringify({ run_id: runId, plan: latest?.repair_plan ?? null, apply: applyResult }, null, 2));
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
    console.error('Usage: rq incident export <run_id> [--out file.rqpack]');
    return 1;
  }
  const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : `${runId}.rqpack`;
  const payload = exportIncidentPack(runId);
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify({ run_id: runId, output: outPath, proof_fingerprint: payload.proof_fingerprint }, null, 2));
  return 0;
}

export async function runIncidentImportCommand(args: string[]): Promise<number> {
  const file = args.find((arg) => !arg.startsWith('-'));
  if (!file) {
    console.error('Usage: rq incident import <file.rqpack>');
    return 1;
  }
  const pack = importIncidentPack(file);
  console.log(JSON.stringify({ run_id: pack.run_id, event_count: pack.tool_events.length, proof_fingerprint: pack.proof_fingerprint }, null, 2));
  return 0;
}

export async function runIncidentReplayCommand(args: string[]): Promise<number> {
  const file = args.find((arg) => !arg.startsWith('-'));
  if (!file) {
    console.error('Usage: rq incident replay <file.rqpack> [--mock]');
    return 1;
  }
  const pack = importIncidentPack(file);
  const replay = replayIncidentPack(pack, { mock_mode: args.includes('--mock') || true, network_isolation: true });
  console.log(JSON.stringify(replay, null, 2));
  return replay.classification_match && replay.diagnosis_match ? 0 : 1;
}

export async function runPermissionCommand(args: string[]): Promise<number> {
  const sub = args[0];
  if (sub === 'list') {
    console.log(JSON.stringify({ requests: listPermissionRequests() }, null, 2));
    return 0;
  }
  if ((sub === 'approve' || sub === 'deny') && args[1]) {
    const event = decidePermission(args[1], sub);
    if (!event) return 1;
    console.log(JSON.stringify(event, null, 2));
    return 0;
  }
  console.error('Usage: rq permission list | rq permission approve <request_id> | rq permission deny <request_id>');
  return 1;
}

export async function runFailuresCommand(args: string[]): Promise<number> {
  const tool = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : undefined;
  const report = getFailurePatternStats(tool);
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

export async function runDemoCommand(): Promise<number> {
  const demo = runRuntimeDemo();
  console.log(JSON.stringify(demo, null, 2));
  return 0;
}
