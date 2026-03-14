#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BUILD_DIR = "build";
const ENGINE_BIN = process.platform === "win32" ? "build/requiem.exe" : "build/requiem";

if (existsSync(BUILD_DIR) && existsSync(ENGINE_BIN)) {
  console.log(`engine binary detected at ${ENGINE_BIN}`);
  process.exit(0);
}

console.log(`engine binary not found at ${ENGINE_BIN}; building engine with \"pnpm run build:engine\"`);
const result = spawnSync("pnpm", ["run", "build:engine"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (typeof result.status === "number") process.exit(result.status);
process.exit(1);
