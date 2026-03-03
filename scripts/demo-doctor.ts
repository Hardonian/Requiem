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
}

// CLI binary path
function getCliPath(): string {
  const releasePath = path.join(ROOT_DIR, "build", "Release", "requiem.exe");
  const debugPath = path.join(ROOT_DIR, "build", "Debug", "requiem.exe");
  
  if (fs.existsSync(releasePath)) return releasePath;
  if (fs.existsSync(debugPath)) return debugPath;
  
  return "requiem";
}

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: ROOT_DIR,
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

  const { exitCode, stdout } = await runCommand(cliPath, ["version"]);
  const durationMs = Date.now() - start;
  
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
  
  const { stdout, exitCode } = await runCommand(cliPath, ["doctor", "--json"]);
  const durationMs = Date.now() - start;
  
  if (exitCode !== 0) {
    let error = `Doctor failed with exit code ${exitCode}`;
    try {
      const result = JSON.parse(stdout);
      if (result.blockers && result.blockers.length > 0) {
        error += `: ${result.blockers.join(", ")}`;
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
    const result = JSON.parse(stdout);
    const blockers = result.blockers?.length || 0;
    if (blockers > 0) {
      return {
        name: "engine_health",
        status: "fail",
        message: `${blockers} blocker(s): ${result.blockers.join(", ")}`,
        durationMs,
      };
    }
    return {
      name: "engine_health",
      status: "pass",
      message: `Engine healthy (hash: ${result.hash_primitive}/${result.hash_backend})`,
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

async function runAllChecks(): Promise<DoctorReport> {
  const checks: CheckResult[] = [];
  
  // Run checks in sequence
  checks.push(await checkCliAvailable());
  checks.push(await checkRequiredFiles());
  checks.push(await checkEnvVars());
  checks.push(await checkJsonParseable());
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
