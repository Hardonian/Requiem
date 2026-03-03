/**
 * rl run command - Start/replay/inspect runs with run_id + trace_id and artifact export
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { RunLogRepository, PromptRepository } from '../db/operator-console.js';
import {
  createArtifactManifest,
  serializeManifest,
  normalizeTimestamp,
  hashContent,
  shortHash,
} from '../lib/deterministic.js';

interface RunStartResult {
  run_id: string;
  trace_id: string;
  status: string;
  prompt_id?: string;
  artifact_path?: string;
  manifest_path?: string;
}

interface RunInspectResult {
  run: {
    run_id: string;
    trace_id: string;
    status: string;
    start_time: string;
    end_time?: string;
    duration_ms?: number;
    prompt_id?: string;
    input_hash?: string;
    output_hash?: string;
    exit_code?: number;
    error_message?: string;
    artifact_path?: string;
    manifest_path?: string;
  };
  artifacts?: {
    manifest: unknown;
    files: Array<{ path: string; exists: boolean }>;
  };
}

export async function runRunCommand(
  subcommand: string,
  args: string[],
  options: { json: boolean; traceId: string; runId: string }
): Promise<number> {
  const repo = new RunLogRepository();

  switch (subcommand) {
    case 'start':
      return runStart(repo, args[0], args.slice(1), options);
    case 'replay':
      return runReplay(repo, args[0], options);
    case 'inspect':
      return runInspect(repo, args[0], options);
    case 'list':
      return runList(repo, args, options);
    default:
      // Default to list if no subcommand
      return runList(repo, args, options);
  }
}

async function runStart(
  repo: RunLogRepository,
  promptName: string,
  varArgs: string[],
  options: { json: boolean; traceId: string; runId: string }
): Promise<number> {
  if (!promptName) {
    console.error('Usage: rl run start <prompt> [var=value ...]');
    return 1;
  }

  const promptRepo = new PromptRepository();
  const prompt = promptRepo.findByName(promptName);

  if (!prompt) {
    console.error(`Prompt not found: ${promptName}`);
    return 1;
  }

  // Parse variables
  const variables: Record<string, string> = {};
  for (const arg of varArgs) {
    const [key, ...valueParts] = arg.split('=');
    if (key && valueParts.length > 0) {
      variables[key] = valueParts.join('=');
    }
  }

  // Create run log entry
  const startTime = normalizeTimestamp(new Date());
  const runId = options.runId;
  const traceId = options.traceId;

  const metadata = {
    prompt_name: prompt.name,
    prompt_version: prompt.version,
    variables,
  };

  repo.create({
    run_id: runId,
    trace_id: traceId,
    prompt_id: prompt.id,
    status: 'running',
    start_time: startTime,
    input_hash: hashContent(JSON.stringify(variables)),
    metadata_json: JSON.stringify(metadata),
  });

  // Simulate execution (in real implementation, this would call the AI)
  await simulateExecution();

  // Generate artifacts
  const artifactDir = path.join(os.homedir(), '.requiem', 'artifacts', runId);
  fs.mkdirSync(artifactDir, { recursive: true });

  // Render prompt
  let rendered = prompt.content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Write output file
  const outputPath = path.join(artifactDir, 'output.txt');
  fs.writeFileSync(outputPath, rendered);

  // Create manifest
  const manifest = createArtifactManifest(
    runId,
    traceId,
    [
      { path: 'output.txt', content: rendered },
      { path: 'metadata.json', content: JSON.stringify(metadata, null, 2) },
    ],
    { prompt: { name: prompt.name, version: prompt.version } }
  );

  const manifestPath = path.join(artifactDir, 'manifest.json');
  fs.writeFileSync(manifestPath, serializeManifest(manifest));

  // Update run log
  const endTime = normalizeTimestamp(new Date());
  const durationMs = Date.now() - new Date(startTime).getTime();

  repo.updateStatus(runId, 'completed', {
    end_time: endTime,
    duration_ms: durationMs,
    output_hash: hashContent(rendered),
    exit_code: 0,
  });
  repo.updateArtifactPath(runId, artifactDir, manifestPath);

  // Increment prompt usage
  promptRepo.incrementUsage(prompt.id);

  const result: RunStartResult = {
    run_id: runId,
    trace_id: traceId,
    status: 'completed',
    prompt_id: prompt.id,
    artifact_path: artifactDir,
    manifest_path,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('');
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ Run Completed                                              │');
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log(`│  Run ID:      ${runId.padEnd(44)}│`);
    console.log(`│  Trace ID:    ${traceId.padEnd(44)}│`);
    console.log(`│  Prompt:      ${prompt.name} v${prompt.version}`.padEnd(59) + '│');
    console.log(`│  Duration:    ${String(durationMs).padEnd(44)}ms│`);
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log(`│  Artifacts:   ${artifactDir.padEnd(44)}│`);
    console.log('└────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  return 0;
}

async function runReplay(
  repo: RunLogRepository,
  runId: string,
  options: { json: boolean; traceId: string; runId: string }
): Promise<number> {
  if (!runId) {
    console.error('Usage: rl run replay <run_id>');
    return 1;
  }

  const original = repo.findByRunId(runId);
  if (!original) {
    console.error(`Run not found: ${runId}`);
    return 1;
  }

  // Create new run as replay
  const newRunId = options.runId;
  const traceId = options.traceId;

  repo.create({
    run_id: newRunId,
    trace_id: traceId,
    parent_run_id: runId,
    prompt_id: original.prompt_id,
    status: 'running',
    start_time: normalizeTimestamp(new Date()),
    input_hash: original.input_hash,
    metadata_json: JSON.stringify({
      replay_of: runId,
      original_metadata: JSON.parse(original.metadata_json),
    }),
  });

  // Simulate replay
  await simulateExecution();

  // Copy artifacts if they exist
  let artifactPath: string | undefined;
  let manifestPath: string | undefined;

  if (original.artifact_path && fs.existsSync(original.artifact_path)) {
    const replayArtifactDir = path.join(os.homedir(), '.requiem', 'artifacts', newRunId);
    fs.mkdirSync(replayArtifactDir, { recursive: true });

    // Copy files
    for (const file of fs.readdirSync(original.artifact_path)) {
      const src = path.join(original.artifact_path, file);
      const dst = path.join(replayArtifactDir, file);
      fs.copyFileSync(src, dst);
    }

    artifactPath = replayArtifactDir;
    manifestPath = path.join(replayArtifactDir, 'manifest.json');
  }

  // Update run log
  repo.updateStatus(newRunId, 'completed', {
    end_time: normalizeTimestamp(new Date()),
    duration_ms: 100, // Simulated
    exit_code: 0,
  });

  if (artifactPath) {
    repo.updateArtifactPath(newRunId, artifactPath, manifestPath!);
  }

  if (options.json) {
    console.log(JSON.stringify({
      run_id: newRunId,
      trace_id: traceId,
      replay_of: runId,
      status: 'completed',
      artifact_path: artifactPath,
    }, null, 2));
  } else {
    console.log(`Replay completed: ${newRunId}`);
    console.log(`Original: ${runId}`);
  }

  return 0;
}

async function runInspect(
  repo: RunLogRepository,
  runId: string,
  options: { json: boolean; traceId: string; runId: string }
): Promise<number> {
  if (!runId) {
    console.error('Usage: rl run inspect <run_id>');
    return 1;
  }

  const run = repo.findByRunId(runId);
  if (!run) {
    console.error(`Run not found: ${runId}`);
    return 1;
  }

  // Load manifest if available
  let manifest: unknown;
  let files: Array<{ path: string; exists: boolean }> = [];

  if (run.manifest_path && fs.existsSync(run.manifest_path)) {
    try {
      manifest = JSON.parse(fs.readFileSync(run.manifest_path, 'utf-8'));

      // Check artifact files
      const artifactDir = path.dirname(run.manifest_path);
      files = fs.readdirSync(artifactDir).map(f => ({
        path: f,
        exists: fs.existsSync(path.join(artifactDir, f)),
      }));
    } catch {
      // Manifest corrupted
    }
  }

  const result: RunInspectResult = {
    run: {
      run_id: run.run_id,
      trace_id: run.trace_id,
      status: run.status,
      start_time: run.start_time,
      end_time: run.end_time,
      duration_ms: run.duration_ms,
      prompt_id: run.prompt_id,
      input_hash: run.input_hash,
      output_hash: run.output_hash,
      exit_code: run.exit_code,
      error_message: run.error_message,
      artifact_path: run.artifact_path,
      manifest_path: run.manifest_path,
    },
  };

  if (manifest) {
    result.artifacts = { manifest, files };
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printInspect(result);
  }

  return 0;
}

async function runList(
  repo: RunLogRepository,
  args: string[],
  options: { json: boolean; traceId: string; runId: string }
): Promise<number> {
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : 10;

  const runs = repo.getRecentRuns(limit);

  if (options.json) {
    console.log(JSON.stringify({ runs }, null, 2));
  } else {
    printRunList(runs);
  }

  return 0;
}

function printRunList(runs: import('../db/operator-console.js').RunLog[]): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Recent Runs                                                │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  Run ID          Status    Duration  Prompt               │');
  console.log('├────────────────────────────────────────────────────────────┤');

  for (const r of runs) {
    const id = r.run_id.substring(0, 16).padEnd(16);
    const status = r.status.padEnd(9);
    const duration = r.duration_ms ? `${r.duration_ms}ms`.padEnd(8) : 'pending '.padEnd(8);
    const prompt = (r.prompt_id ? shortHash(r.prompt_id) : 'none').padEnd(21);
    console.log(`│ ${id} ${status} ${duration} ${prompt} │`);
  }

  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Total: ${String(runs.length).padEnd(48)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

function printInspect(result: RunInspectResult): void {
  const run = result.run;

  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Run Inspection                                             │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  Run ID:      ${run.run_id.padEnd(44)}│`);
  console.log(`│  Trace ID:    ${run.trace_id.padEnd(44)}│`);
  console.log(`│  Status:      ${run.status.padEnd(44)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ TIMING                                                     │');
  console.log(`│  Started:     ${run.start_time.padEnd(44)}│`);
  if (run.end_time) {
    console.log(`│  Ended:       ${run.end_time.padEnd(44)}│`);
    console.log(`│  Duration:    ${String(run.duration_ms).padEnd(44)}ms│`);
  }
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ HASHES                                                     │');
  console.log(`│  Input:       ${(run.input_hash || 'none').padEnd(44)}│`);
  console.log(`│  Output:      ${(run.output_hash || 'none').padEnd(44)}│`);

  if (result.artifacts) {
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ ARTIFACTS                                                  │');
    for (const file of result.artifacts.files) {
      const icon = file.exists ? '●' : '○';
      console.log(`│  ${icon} ${file.path.padEnd(53)}│`);
    }
  }

  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

async function simulateExecution(): Promise<void> {
  // Simulate some async work
  return new Promise(resolve => setTimeout(resolve, 100));
}

export default runRunCommand;
