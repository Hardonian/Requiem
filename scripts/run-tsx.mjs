#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-tsx.mjs <script.ts> [args...]");
  process.exit(2);
}

const env = { ...process.env };
const isLinux = process.platform === "linux";
const tmpCandidate = env.TMPDIR || env.TMP || env.TEMP || "";

// tsx creates an IPC socket under tmp; drvfs paths in WSL can reject unix sockets.
if (isLinux && tmpCandidate.startsWith("/mnt/")) {
  env.TMPDIR = "/tmp";
  env.TMP = "/tmp";
  env.TEMP = "/tmp";
}

const child = spawn(process.execPath, ["--import", "tsx", ...args], {
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
