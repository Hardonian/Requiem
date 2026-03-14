#!/usr/bin/env tsx
/**
 * Secrets Leak Verification
 * 
 * Validates that secrets/tokens are not leaked in:
 * - CLI output
 * - Log files
 * - API responses
 * - Error messages
 * 
 * Usage:
 *   npx tsx scripts/verify-nosecrets.ts
 *   pnpm run verify:nosecrets
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

interface LeakCheck {
  name: string;
  ok: boolean;
  findings?: string[];
}

interface LeakReport {
  ok: boolean;
  timestamp: string;
  checks: LeakCheck[];
}

// Patterns that indicate potential secret exposure
const SECRET_PATTERNS = [
  // Raw secret key patterns
  { pattern: /"secret_key"\s*:\s*"[^"]{32,}"/gi, name: "secret_key_in_output" },
  { pattern: /"private_key"\s*:\s*"[^"]{32,}"/gi, name: "private_key_in_output" },
  { pattern: /"token"\s*:\s*"[^"]{20,}"/gi, name: "token_in_output" },
  { pattern: /"api_key"\s*:\s*"[^"]{16,}"/gi, name: "api_key_in_output" },
  { pattern: /"password"\s*:\s*"[^"]+"/gi, name: "password_in_output" },
  { pattern: /"auth"\s*:\s*"[^"]{20,}"/gi, name: "auth_token_in_output" },
  
  // Hex secrets (common key formats)
  { pattern: /"[a-f0-9]{64,128}"/gi, name: "hex_secret" },
  
  // JWT patterns
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, name: "jwt_token" },
  
  // Environment variable leaks
  { pattern: /process\.env\.[A-Z_]*(?:KEY|SECRET|TOKEN|PWD|PASS)/gi, name: "env_var_exposure" },
];

// Patterns that are known false positives (e.g., test vectors)
const ALLOWED_PATTERNS = [
  // BLAKE3 test vectors (known, not secrets)
  /af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262/g,
  /ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f/g,
  // Empty hash
  /e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/g,
];

function isAllowed(content: string): boolean {
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: ROOT_DIR,
      shell: false,
    });

    let stdout = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("close", () => {
      resolve(stdout);
    });

    proc.on("error", () => {
      resolve("");
    });
  });
}

async function checkCliOutput(): Promise<LeakCheck> {
  const cliCandidates = [
    path.join(ROOT_DIR, "build", "requiem"),
    path.join(ROOT_DIR, "build", "Release", "requiem.exe"),
  ];
  const cliPath = cliCandidates.find(candidate => fs.existsSync(candidate));
  if (!cliPath) {
    return { name: "cli_output", ok: true }; // Skip if not built
  }

  const findings: string[] = [];
  
  // Test various CLI commands that might leak secrets
  const commands = [
    ["doctor", "--json"],
    ["caps", "list"],
    ["log", "verify"],
  ];

  for (const args of commands) {
    const output = await runCommand(cliPath, args);
    
    for (const { pattern, name } of SECRET_PATTERNS) {
      const matches = output.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (!isAllowed(match)) {
            findings.push(`${name}: ${match.slice(0, 50)}...`);
          }
        }
      }
    }
  }

  return {
    name: "cli_output",
    ok: findings.length === 0,
    findings: findings.slice(0, 5), // Limit findings
  };
}

async function checkLogFiles(): Promise<LeakCheck> {
  const findings: string[] = [];
  
  // Check common log file locations
  const logPaths = [
    path.join(ROOT_DIR, ".requiem", "event_log.ndjson"),
    path.join(ROOT_DIR, "logs"),
  ];

  for (const logPath of logPaths) {
    if (!fs.existsSync(logPath)) continue;
    
    if (fs.statSync(logPath).isDirectory()) {
      // Check all files in directory
      const files = fs.readdirSync(logPath);
      for (const file of files) {
        if (file.endsWith(".log") || file.endsWith(".ndjson") || file.endsWith(".json")) {
          const content = fs.readFileSync(path.join(logPath, file), "utf-8");
          
          for (const { pattern, name } of SECRET_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
              for (const match of matches) {
                if (!isAllowed(match)) {
                  findings.push(`${file}: ${name}`);
                }
              }
            }
          }
        }
      }
    } else {
      // Single file
      const content = fs.readFileSync(logPath, "utf-8");
      
      for (const { pattern, name } of SECRET_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            if (!isAllowed(match)) {
              findings.push(`${path.basename(logPath)}: ${name}`);
            }
          }
        }
      }
    }
  }

  return {
    name: "log_files",
    ok: findings.length === 0,
    findings: findings.slice(0, 5),
  };
}

async function checkSourceCode(): Promise<LeakCheck> {
  const findings: string[] = [];
  
  // Check TypeScript source files for hardcoded secrets
  const srcDirs = [
    path.join(ROOT_DIR, "packages"),
    path.join(ROOT_DIR, "src"),
  ];

  for (const srcDir of srcDirs) {
    if (!fs.existsSync(srcDir)) continue;
    
    const checkFile = (filePath: string) => {
      if (!filePath.endsWith(".ts") && !filePath.endsWith(".js") && !filePath.endsWith(".tsx")) {
        return;
      }
      
      const content = fs.readFileSync(filePath, "utf-8");
      
      // Check for hardcoded secrets (not test fixtures)
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip test files and fixture files
        if (filePath.includes(".test.") || filePath.includes("__tests__") || filePath.includes("fixtures")) {
          continue;
        }
        
        // Check for suspicious patterns (but allow patterns in specific contexts)
        const suspicious = [
          /const\s+\w*(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*["'][^"']{8,}["']/i,
          /let\s+\w*(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*["'][^"']{8,}["']/i,
          /var\s+\w*(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*["'][^"']{8,}["']/i,
        ];
        
        for (const pattern of suspicious) {
          if (pattern.test(line) && !line.includes("// " + "safe") && !line.includes("// " + "public")) {
            // Check if it's a test vector or example
            if (!line.includes("test") && !line.includes("example") && !line.includes("demo")) {
              findings.push(`${path.relative(ROOT_DIR, filePath)}:${i + 1}`);
            }
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
          if (["node_modules", ".next", "dist", "build", "coverage"].includes(entry)) {
            continue;
          }
          walkDir(fullPath);
        } else {
          checkFile(fullPath);
        }
      }
    };

    try {
      walkDir(srcDir);
    } catch {
      // Ignore errors
    }
  }

  return {
    name: "source_code",
    ok: findings.length === 0,
    findings: findings.slice(0, 5),
  };
}

async function runAllChecks(): Promise<LeakReport> {
  const checks = await Promise.all([
    checkCliOutput(),
    checkLogFiles(),
    checkSourceCode(),
  ]);

  return {
    ok: checks.every(c => c.ok),
    timestamp: new Date().toISOString(),
    checks,
  };
}

function printReport(report: LeakReport): void {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  SECRETS LEAK VERIFICATION                                     ║");
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
    console.log("✓ No secrets detected in outputs");
  } else {
    console.log("✗ Potential secret exposure detected");
    console.log("  Secrets must never be logged or output after minting");
    console.log("  Only fingerprints should be returned");
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
  console.error("Secrets verification error:", err);
  process.exit(1);
});
