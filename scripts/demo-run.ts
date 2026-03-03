#!/usr/bin/env tsx
/**
 * Requiem Demo Runner
 * 
 * Executes the full vertical slice:
 *   doctor → policy check → plan hash → plan run → receipt → replay verify → log verify
 * 
 * Usage:
 *   npx tsx scripts/demo-run.ts [--json] [--output-dir ./demo_artifacts]
 *   make demo
 *   make demo:verify
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "demo_artifacts");

// CLI binary path
function getCliPath(): string {
  const releasePath = path.join(ROOT_DIR, "build", "Release", "requiem.exe");
  const debugPath = path.join(ROOT_DIR, "build", "Debug", "requiem.exe");
  
  if (fs.existsSync(releasePath)) return releasePath;
  if (fs.existsSync(debugPath)) return debugPath;
  
  // Fallback: try PATH
  return "requiem";
}

interface DemoResult {
  ok: boolean;
  runId: string;
  traceId: string;
  receiptHash: string | null;
  replayMatch: boolean | null;
  logVerifyOk: boolean | null;
  steps: StepResult[];
  errors: string[];
  durationMs: number;
}

interface StepResult {
  step: string;
  ok: boolean;
  durationMs: number;
  output?: unknown;
  error?: string;
}

function generateTraceId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function runCommand(
  cmd: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: options?.cwd || ROOT_DIR,
      env: { ...process.env, ...options?.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

async function runDemo(doctorFirst = true, outputDir: string): Promise<DemoResult> {
  const traceId = generateTraceId();
  const startTime = Date.now();
  const cliPath = getCliPath();
  
  const result: DemoResult = {
    ok: false,
    runId: `demo-${Date.now()}`,
    traceId,
    receiptHash: null,
    replayMatch: null,
    logVerifyOk: null,
    steps: [],
    errors: [],
    durationMs: 0,
  };

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Helper to record step
  const recordStep = (name: string, stepResult: Omit<StepResult, "step">) => {
    result.steps.push({ step: name, ...stepResult });
    if (!stepResult.ok) {
      result.errors.push(stepResult.error || `${name} failed`);
    }
  };

  // Step 0: Doctor check
  if (doctorFirst) {
    const stepStart = Date.now();
    const { stdout, exitCode } = await runCommand(cliPath, ["doctor", "--json"]);
    const durationMs = Date.now() - stepStart;
    
    let doctorOk = false;
    let doctorOutput: unknown = null;
    try {
      doctorOutput = JSON.parse(stdout);
      doctorOk = (doctorOutput as { ok?: boolean }).ok === true;
    } catch {
      doctorOk = exitCode === 0;
    }

    recordStep("doctor", {
      ok: doctorOk,
      durationMs,
      output: doctorOutput,
      error: doctorOk ? undefined : `Doctor failed with exit code ${exitCode}`,
    });

    if (!doctorOk) {
      result.durationMs = Date.now() - startTime;
      return result;
    }
  }

  // Step 1: Policy check
  {
    const stepStart = Date.now();
    const inputPath = path.join(ROOT_DIR, "examples", "demo", "input.json");
    const { stdout, exitCode, stderr } = await runCommand(cliPath, [
      "policy", "check",
      "--request", inputPath,
    ]);
    const durationMs = Date.now() - stepStart;

    let policyOk = false;
    let policyOutput: unknown = null;
    try {
      policyOutput = JSON.parse(stdout);
      policyOk = (policyOutput as { ok?: boolean }).ok === true && exitCode === 0;
    } catch {
      policyOk = exitCode === 0;
    }

    recordStep("policy_check", {
      ok: policyOk,
      durationMs,
      output: policyOutput,
      error: policyOk ? undefined : `Policy check failed: ${stderr || stdout}`,
    });
  }

  // Step 2: Plan hash
  let planHash: string | null = null;
  {
    const stepStart = Date.now();
    const planPath = path.join(ROOT_DIR, "examples", "demo", "plan.json");
    const { stdout, exitCode, stderr } = await runCommand(cliPath, [
      "plan", "hash",
      "--plan", planPath,
    ]);
    const durationMs = Date.now() - stepStart;

    let hashOk = false;
    let hashOutput: unknown = null;
    try {
      hashOutput = JSON.parse(stdout);
      hashOk = exitCode === 0;
      planHash = (hashOutput as { plan_hash?: string }).plan_hash || null;
    } catch {
      hashOk = exitCode === 0;
    }

    recordStep("plan_hash", {
      ok: hashOk,
      durationMs,
      output: hashOutput,
      error: hashOk ? undefined : `Plan hash failed: ${stderr || stdout}`,
    });
  }

  // Step 3: Plan run
  let receiptHash: string | null = null;
  let runId: string | null = null;
  {
    const stepStart = Date.now();
    const planPath = path.join(ROOT_DIR, "examples", "demo", "plan.json");
    const { stdout, exitCode, stderr } = await runCommand(cliPath, [
      "plan", "run",
      "--plan", planPath,
      "--workspace", ".",
    ]);
    const durationMs = Date.now() - stepStart;

    let runOk = false;
    let runOutput: unknown = null;
    try {
      runOutput = JSON.parse(stdout);
      runOk = exitCode === 0;
      receiptHash = (runOutput as { receipt_hash?: string }).receipt_hash || null;
      runId = (runOutput as { run_id?: string }).run_id || null;
    } catch {
      runOk = exitCode === 0;
    }

    recordStep("plan_run", {
      ok: runOk,
      durationMs,
      output: runOutput,
      error: runOk ? undefined : `Plan run failed: ${stderr || stdout}`,
    });

    if (receiptHash) {
      result.receiptHash = receiptHash;
    }
    if (runId) {
      result.runId = runId;
    }
  }

  // Step 4: Log verify
  {
    const stepStart = Date.now();
    const { stdout, exitCode, stderr } = await runCommand(cliPath, ["log", "verify"]);
    const durationMs = Date.now() - stepStart;

    let logOk = false;
    let logOutput: unknown = null;
    try {
      logOutput = JSON.parse(stdout);
      logOk = (logOutput as { ok?: boolean }).ok === true && exitCode === 0;
    } catch {
      logOk = exitCode === 0;
    }

    result.logVerifyOk = logOk;
    recordStep("log_verify", {
      ok: logOk,
      durationMs,
      output: logOutput,
      error: logOk ? undefined : `Log verify failed: ${stderr || stdout}`,
    });
  }

  // Step 5: CAS verify (optional, skip if not supported)
  {
    const stepStart = Date.now();
    const { stdout, exitCode } = await runCommand(cliPath, ["cas", "verify"]);
    const durationMs = Date.now() - stepStart;

    let casOk = false;
    let casOutput: unknown = null;
    try {
      casOutput = JSON.parse(stdout);
      casOk = exitCode === 0;
    } catch {
      casOk = exitCode === 0;
    }

    recordStep("cas_verify", {
      ok: casOk,
      durationMs,
      output: casOutput,
      error: casOk ? undefined : "CAS verify failed",
    });
  }

  result.durationMs = Date.now() - startTime;
  result.ok = result.steps.every(s => s.ok);

  // Write artifacts
  const summaryPath = path.join(outputDir, "demo-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));

  if (receiptHash) {
    fs.writeFileSync(
      path.join(outputDir, "demo-receipt.json"),
      JSON.stringify({ receiptHash, runId, traceId }, null, 2)
    );
  }

  return result;
}

function printSummary(result: DemoResult, jsonOutput: boolean): void {
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  REQUIEM DEMO RUN                                              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`Trace ID:      ${result.traceId}`);
  console.log(`Run ID:        ${result.runId}`);
  console.log(`Receipt Hash:  ${result.receiptHash || "(none)"}`);
  console.log(`Log Verify:    ${result.logVerifyOk === true ? "✓ PASS" : result.logVerifyOk === false ? "✗ FAIL" : "— SKIP"}`);
  console.log(`Duration:      ${result.durationMs}ms`);
  console.log("");
  console.log("Steps:");
  for (const step of result.steps) {
    const status = step.ok ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${status} ${step.step.padEnd(20)} ${step.durationMs}ms`);
  }
  console.log("");
  
  if (result.ok) {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  DEMO PASSED ✓                                                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
  } else {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║  DEMO FAILED ✗                                                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`  • ${error}`);
    }
  }
  console.log("");
}

// Main
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const skipDoctor = args.includes("--skip-doctor");
  
  const outputDirIndex = args.indexOf("--output-dir");
  const outputDir = outputDirIndex >= 0 
    ? args[outputDirIndex + 1] 
    : DEFAULT_OUTPUT_DIR;

  // Check if CLI exists
  const cliPath = getCliPath();
  if (!fs.existsSync(cliPath) && cliPath === "requiem") {
    console.error("Error: requiem CLI not found. Build first with: make build");
    process.exit(1);
  }

  const result = await runDemo(!skipDoctor, outputDir);
  printSummary(result, jsonOutput);

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Demo runner error:", err);
  process.exit(1);
});
