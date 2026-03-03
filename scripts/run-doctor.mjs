#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isWindows = process.platform === "win32";

const cmd = isWindows ? "powershell" : "bash";
const cmdArgs = isWindows
  ? ["-ExecutionPolicy", "Bypass", "-File", "scripts/doctor.ps1", ...args]
  : ["scripts/doctor.sh", ...args];

const result = spawnSync(cmd, cmdArgs, { stdio: "inherit" });

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error.message);
}

process.exit(1);
