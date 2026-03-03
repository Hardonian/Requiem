#!/usr/bin/env tsx
/**
 * Stack Trace Leak Verification
 * 
 * Validates that web/API responses don't emit raw stack traces.
 * All errors must be wrapped in typed envelopes without internal details.
 * 
 * Usage:
 *   npx tsx scripts/verify-no-stack-leaks.ts
 *   pnpm run verify:no-stack-leaks
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

interface StackCheck {
  name: string;
  ok: boolean;
  findings?: string[];
}

interface StackReport {
  ok: boolean;
  timestamp: string;
  checks: StackCheck[];
}

// Patterns that indicate potential stack trace exposure
const STACK_PATTERNS = [
  // Common stack trace formats
  { pattern: /at\s+\w+\s+\([^)]+:\d+:\d+\)/g, name: "v8_stack_trace" },
  { pattern: /\s+at\s+[/\w.]+:\d+:\d+/g, name: "stack_line" },
  { pattern: /Error:\s*\n\s*at\s+/g, name: "error_with_stack" },
  
  // Stack trace in JSON fields
  { pattern: /"stack"\s*:\s*"[^"]*at\s+/gi, name: "stack_field_in_json" },
  { pattern: /"traceback"\s*:/gi, name: "traceback_field" },
  { pattern: /"stacktrace"\s*:/gi, name: "stacktrace_field" },
  
  // File path exposures in errors
  { pattern: /"file"\s*:\s*"[^"]*(?:src|lib|node_modules)[^"]*"/gi, name: "file_path_exposure" },
  { pattern: /"path"\s*:\s*"[^"]*(?:src|lib|internal)[^"]*"/gi, name: "path_exposure" },
  
  // Internal module references
  { pattern: /\bnode_modules\/[\w/-]+/g, name: "node_modules_path" },
  { pattern: /\bsrc\/[\w/]+\.ts:\d+/g, name: "source_path_with_line" },
];

// Patterns that are known false positives
const ALLOWED_PATTERNS = [
  // Test files can have stack traces
  /\.test\.ts/,
  /\.spec\.ts/,
  /__tests__/,
  
  // Documentation examples
  /docs\//,
  
  // Scripts that handle errors intentionally
  /scripts\/verify-.*\.ts/,
];

function isAllowed(filePath: string): boolean {
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }
  return false;
}

async function checkApiErrorHandlers(): Promise<StackCheck> {
  const findings: string[] = [];
  
  // Check API route handlers for proper error wrapping
  const apiDir = path.join(ROOT_DIR, "ready-layer", "src", "app", "api");
  if (!fs.existsSync(apiDir)) {
    return { name: "api_error_handlers", ok: true };
  }

  const checkFile = (filePath: string) => {
    if (!filePath.endsWith("route.ts") && !filePath.endsWith(".js")) {
      return;
    }
    
    if (isAllowed(filePath)) return;
    
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for direct error returns that might include stacks
      if (line.includes("res.json") || line.includes("Response.json") || line.includes("return json(")) {
        // Check if error is properly wrapped
        if (line.includes("error") && !line.includes("code") && !line.includes("message")) {
          findings.push(`${path.relative(ROOT_DIR, filePath)}:${i + 1}: potential unwrapped error`);
        }
      }
      
      // Check for error objects being serialized directly
      if (/error\s*[=:]\s*err(?:or)?\b/i.test(line) && !line.includes("// " + "wrapped")) {
        const nextLines = lines.slice(i + 1, Math.min(i + 5, lines.length));
        const nextContent = nextLines.join(" ");
        if (nextContent.includes("JSON.stringify") || nextContent.includes(".json(")) {
          findings.push(`${path.relative(ROOT_DIR, filePath)}:${i + 1}: direct error serialization`);
        }
      }
    }
  };

  const walkDir = (dir: string) => {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else {
        checkFile(fullPath);
      }
    }
  };

  try {
    walkDir(apiDir);
  } catch {
    // Directory might not exist
  }

  return {
    name: "api_error_handlers",
    ok: findings.length === 0,
    findings: findings.slice(0, 10),
  };
}

async function checkErrorResponseFiles(): Promise<StackCheck> {
  const findings: string[] = [];
  
  // Check for error response utilities
  const patterns = [
    path.join(ROOT_DIR, "ready-layer", "src", "lib"),
    path.join(ROOT_DIR, "packages"),
  ];

  for (const dir of patterns) {
    if (!fs.existsSync(dir)) continue;
    
    const checkFile = (filePath: string) => {
      if (!filePath.endsWith(".ts") && !filePath.endsWith(".js")) {
        return;
      }
      
      if (isAllowed(filePath)) return;
      
      const content = fs.readFileSync(filePath, "utf-8");
      
      // Check for stack trace patterns in JSON responses
      for (const { pattern, name } of STACK_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          // Check if this is in an error response context
          if (content.includes("error") || content.includes("response") || filePath.includes("error")) {
            findings.push(`${path.relative(ROOT_DIR, filePath)}: ${name}`);
            break; // One finding per file is enough
          }
        }
      }
    };

    const walkDir = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir);
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !entry.includes("node_modules")) {
          walkDir(fullPath);
        } else {
          checkFile(fullPath);
        }
      }
    };

    try {
      walkDir(dir);
    } catch {
      // Ignore errors
    }
  }

  return {
    name: "error_response_files",
    ok: findings.length === 0,
    findings: findings.slice(0, 10),
  };
}

async function checkCliErrorOutput(): Promise<StackCheck> {
  const findings: string[] = [];
  
  // Check CLI source for stack trace handling
  const cliDir = path.join(ROOT_DIR, "src");
  if (!fs.existsSync(cliDir)) {
    return { name: "cli_error_output", ok: true };
  }

  const checkFile = (filePath: string) => {
    if (!filePath.endsWith(".cpp") && !filePath.endsWith(".hpp")) {
      return;
    }
    
    const content = fs.readFileSync(filePath, "utf-8");
    
    // Check for exception handling that might leak details
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for direct exception what() output in JSON
      if (line.includes("e.what()") || line.includes("exception::what()")) {
        // Check if it's wrapped properly
        if (!line.includes("escape") && !line.includes("sanitize")) {
          findings.push(`${path.relative(ROOT_DIR, filePath)}:${i + 1}: raw exception output`);
        }
      }
    }
  };

  const walkDir = (dir: string) => {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else {
        checkFile(fullPath);
      }
    }
  };

  try {
    walkDir(cliDir);
  } catch {
    // Ignore errors
  }

  return {
    name: "cli_error_output",
    ok: findings.length === 0,
    findings: findings.slice(0, 5),
  };
}

async function runAllChecks(): Promise<StackReport> {
  const checks = await Promise.all([
    checkApiErrorHandlers(),
    checkErrorResponseFiles(),
    checkCliErrorOutput(),
  ]);

  return {
    ok: checks.every(c => c.ok),
    timestamp: new Date().toISOString(),
    checks,
  };
}

function printReport(report: StackReport): void {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  STACK TRACE LEAK VERIFICATION                                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");
  
  for (const check of report.checks) {
    const icon = check.ok ? "✓" : "✗";
    console.log(`${icon} ${check.name}`);
    if (!check.ok && check.findings) {
      for (const finding of check.findings) {
        console.log(`  Finding: ${finding}`);
      }
    }
  }
  
  console.log("");
  if (report.ok) {
    console.log("✓ No stack trace leak patterns detected");
  } else {
    console.log("✗ Potential stack trace leak patterns detected");
    console.log("  All errors must be wrapped in typed envelopes");
    console.log("  Response must include: code, message, hint");
    console.log("  Response must NOT include: stack, file paths, internal details");
  }
  console.log("");
}

// Main
async function main(): Promise<void> {
  const report = await runAllChecks();
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Stack leak verification error:", err);
  process.exit(1);
});
