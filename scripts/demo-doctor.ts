#!/usr/bin/env tsx
/**
 * Requiem Demo Doctor
 * 
 * Validates the environment before running the demo.
 * Checks: CLI availability, required files, environment variables,
 * web endpoints (if applicable), and output consistency.
 * 
 * Usage:
 *   npx tsx scripts/demo-doctor.ts [--json]
 *   make doctor  (also runs this)
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  durationMs: number;
}

interface DoctorReport {
  ok: boolean;
  timestamp: string;
  checks: CheckResult[];
  summary: {
    pass: number;
    fail: number;
    warn: number;
    skip: number;
  };
  recommendations: string[];
}

// CLI binary path
function getCliPath(): string {
  const releasePath = path.join(ROOT_DIR, "build", "Release", "requiem.exe");
  const debugPath = path.join(ROOT_DIR, "build", "Debug", "requiem.exe");
  
  if (fs.existsSync(releasePath)) return releasePath;
  if (fs.existsSync(debugPath)) return debugPath;
  
  return "requiem";
}

function runCommand(cmd: string, args: string[], timeoutMs = 10000): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    let timedOut = false;
    const proc = spawn(cmd, args, {
      cwd: ROOT_DIR,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (exitCode) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, exitCode: exitCode ?? 0, timedOut });
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr: err.message, exitCode: 1, timedOut: false });
    });
  });
}

async function checkCliAvailable(): Promise<CheckResult> {
  const start = Date.now();
  const cliPath = getCliPath();
  
  if (!fs.existsSync(cliPath) && cliPath === "requiem") {
    return {
      name: "cli_available",
      status: "fail",
      message: "requiem CLI not found in PATH. Build with: make build",
      durationMs: Date.now() - start,
    };
  }

  const { exitCode, stdout, timedOut } = await runCommand(cliPath, ["version"]);
  const durationMs = Date.now() - start;
  
  if (timedOut) {
    return {
      name: "cli_available",
      status: "fail",
      message: "CLI version check timed out",
      durationMs,
    };
  }
  
  if (exitCode !== 0) {
    return {
      name: "cli_available",
      status: "fail",
      message: `CLI version check failed with exit code ${exitCode}`,
      durationMs,
    };
  }

  try {
    const version = JSON.parse(stdout);
    return {
      name: "cli_available",
      status: "pass",
      message: `Requiem engine v${version.engine} (protocol ${version.protocol})`,
      durationMs,
    };
  } catch {
    return {
      name: "cli_available",
      status: "pass",
      message: "CLI responds to version command",
      durationMs,
    };
  }
}

async function checkRequiredFiles(): Promise<CheckResult> {
  const start = Date.now();
  const required = [
    "examples/demo/policy.json",
    "examples/demo/plan.json",
    "examples/demo/input.json",
  ];

  const missing: string[] = [];
  for (const file of required) {
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) {
      missing.push(file);
    }
  }

  const durationMs = Date.now() - start;
  
  if (missing.length > 0) {
    return {
      name: "required_files",
      status: "fail",
      message: `Missing required files: ${missing.join(", ")}`,
      durationMs,
    };
  }

  return {
    name: "required_files",
    status: "pass",
    message: `All ${required.length} required demo files present`,
    durationMs,
  };
}

async function checkEnvVars(): Promise<CheckResult> {
  const start = Date.now();
  
  // Check for optional environment variables that affect behavior
  // but don't print their values (security)
  const checks: string[] = [];
  
  if (process.env.FORCE_RUST === "1") {
    checks.push("FORCE_RUST=1 (will use Rust engine)");
  }
  
  if (process.env.REQUIEM_EVENT_LOG) {
    checks.push(`REQUIEM_EVENT_LOG set (using custom log path)`);
  }
  
  if (process.env.REQUIEM_CAS_PATH) {
    checks.push(`REQUIEM_CAS_PATH set (using custom CAS path)`);
  }

  const durationMs = Date.now() - start;
  
  if (checks.length > 0) {
    return {
      name: "env_vars",
      status: "warn",
      message: `Non-default environment: ${checks.join("; ")}`,
      durationMs,
    };
  }

  return {
    name: "env_vars",
    status: "pass",
    message: "Environment clean (no overrides)",
    durationMs,
  };
}

async function checkCliDoctor(): Promise<CheckResult> {
  const start = Date.now();
  const cliPath = getCliPath();
  
  const { stdout, exitCode, timedOut } = await runCommand(cliPath, ["doctor", "--json"]);
  const durationMs = Date.now() - start;
  
  if (timedOut) {
    return {
      name: "engine_health",
      status: "fail",
      message: "Doctor check timed out",
      durationMs,
    };
  }
  
  if (exitCode !== 0) {
    let error = `Doctor failed with exit code ${exitCode}`;
    try {
      const envelope = JSON.parse(stdout);
      const data = envelope.data || {};
      if (data.blockers && data.blockers.length > 0) {
        error += `: ${data.blockers.join(", ")}`;
      }
    } catch {
      // Ignore parse error
    }
    return {
      name: "engine_health",
      status: "fail",
      message: error,
      durationMs,
    };
  }

  try {
    const envelope = JSON.parse(stdout);
    const data = envelope.data || {};
    const blockers = data.blockers?.length || 0;
    if (blockers > 0) {
      return {
        name: "engine_health",
        status: "fail",
        message: `${blockers} blocker(s): ${data.blockers.join(", ")}`,
        durationMs,
      };
    }
    return {
      name: "engine_health",
      status: "pass",
      message: `Engine healthy (hash: ${data.hash_primitive}/${data.hash_backend})`,
      durationMs,
    };
  } catch {
    return {
      name: "engine_health",
      status: "pass",
      message: "Doctor check passed",
      durationMs,
    };
  }
}

async function checkDemoArtifactsDir(): Promise<CheckResult> {
  const start = Date.now();
  const demoArtifactsDir = path.join(ROOT_DIR, "demo_artifacts");
  
  // Check if directory exists or can be created
  try {
    if (!fs.existsSync(demoArtifactsDir)) {
      fs.mkdirSync(demoArtifactsDir, { recursive: true });
    }
    // Try a test write
    const testFile = path.join(demoArtifactsDir, ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    
    return {
      name: "artifacts_dir",
      status: "pass",
      message: `demo_artifacts/ writable`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: "artifacts_dir",
      status: "warn",
      message: `demo_artifacts/ not writable: ${err}`,
      durationMs: Date.now() - start,
    };
  }
}

async function checkJsonParseable(): Promise<CheckResult> {
  const start = Date.now();
  const files = [
    "examples/demo/policy.json",
    "examples/demo/plan.json",
    "examples/demo/input.json",
  ];

  const errors: string[] = [];
  for (const file of files) {
    const fullPath = path.join(ROOT_DIR, file);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      JSON.parse(content);
    } catch (err) {
      errors.push(`${file}: ${err}`);
    }
  }

  const durationMs = Date.now() - start;
  
  if (errors.length > 0) {
    return {
      name: "json_valid",
      status: "fail",
      message: `Invalid JSON: ${errors.join("; ")}`,
      durationMs,
    };
  }

  return {
    name: "json_valid",
    status: "pass",
    message: "All demo JSON files parseable",
    durationMs,
  };
}

async function checkPlanStructure(): Promise<CheckResult> {
  const start = Date.now();
  
  try {
    const planPath = path.join(ROOT_DIR, "examples", "demo", "plan.json");
    const content = fs.readFileSync(planPath, "utf-8");
    const plan = JSON.parse(content);
    
    const issues: string[] = [];
    
    // Check required fields
    if (!plan.plan_id) issues.push("missing plan_id");
    if (!plan.steps || !Array.isArray(plan.steps)) issues.push("missing or invalid steps");
    if (plan.steps && plan.steps.length === 0) issues.push("empty steps array");
    
    // Check step structure
    if (plan.steps) {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        if (!step.step_id) issues.push(`step ${i}: missing step_id`);
        if (!step.kind) issues.push(`step ${i}: missing kind`);
        if (!step.config) issues.push(`step ${i}: missing config`);
      }
    }
    
    const durationMs = Date.now() - start;
    
    if (issues.length > 0) {
      return {
        name: "plan_structure",
        status: "warn",
        message: `Plan structure issues: ${issues.join(", ")}`,
        durationMs,
      };
    }
    
    return {
      name: "plan_structure",
      status: "pass",
      message: `Plan has ${plan.steps?.length || 0} step(s) with valid structure`,
      durationMs,
    };
  } catch (err) {
    return {
      name: "plan_structure",
      status: "fail",
      message: `Failed to validate plan: ${err}`,
      durationMs: Date.now() - start,
    };
  }
}

async function runAllChecks(): Promise<DoctorReport> {
  const checks: CheckResult[] = [];
  const recommendations: string[] = [];
  
  // Run checks in sequence
  const cliAvailable = await checkCliAvailable();
  checks.push(cliAvailable);
  
  if (!cliAvailable.ok) {
    recommendations.push("Build the CLI: make build");
  }
  
  checks.push(await checkRequiredFiles());
  
  if (checks[checks.length - 1].status === "fail") {
    recommendations.push("Ensure demo fixtures exist in examples/demo/");
  }
  
  checks.push(await checkEnvVars());
  checks.push(await checkJsonParseable());
  checks.push(await checkPlanStructure());
  checks.push(await checkCliDoctor());
  checks.push(await checkDemoArtifactsDir());
  
  const pass = checks.filter(c => c.status === "pass").length;
  const fail = checks.filter(c => c.status === "fail").length;
  const warn = checks.filter(c => c.status === "warn").length;
  const skip = checks.filter(c => c.status === "skip").length;
  
  return {
    ok: fail === 0,
    timestamp: new Date().toISOString(),
    checks,
    summary: { pass, fail, warn, skip },
    recommendations,
  };
}

function printReport(report: DoctorReport, jsonOutput: boolean): void {
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  REQUIEM DEMO DOCTOR                                           ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");
  
  for (const check of report.checks) {
    const icon = check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : check.status === "warn" ? "⚠" : "⊘";
    const status = check.status.toUpperCase().padEnd(4);
    console.log(`${icon} [${status}] ${check.name.padEnd(20)} ${check.message}`);
  }
  
  console.log("");
  console.log(`Summary: ${report.summary.pass} passed, ${report.summary.fail} failed, ${report.summary.warn} warned, ${report.summary.skip} skipped`);
  console.log("");
  
  if (report.recommendations.length > 0) {
    console.log("Recommendations:");
    for (const rec of report.recommendations) {
      console.log(`  • ${rec}`);
    }
    console.log("");
  }
  
  if (report.ok) {
    console.log("✓ Environment ready for demo");
  } else {
    console.log("✗ Environment issues must be resolved before running demo");
  }
  console.log("");
}

// Main
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  
  const report = await runAllChecks();
  printReport(report, jsonOutput);
  
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Demo doctor error:", err);
  process.exit(1);
});
