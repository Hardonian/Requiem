#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BUILD_DIR = "build";
const ENGINE_BIN = process.platform === "win32" ? "build/requiem.exe" : "build/requiem";

if (existsSync(BUILD_DIR) && existsSync(ENGINE_BIN)) {
  console.log(`engine binary detected at ${ENGINE_BIN}`);
  process.exit(0);
}

const partialBuild = existsSync(BUILD_DIR) && !existsSync(ENGINE_BIN);
if (partialBuild) {
  console.warn(
    `engine build appears incomplete: found ${BUILD_DIR} but missing ${ENGINE_BIN}; rebuilding with "pnpm run build:engine"`,
  );
} else {
  console.log(`engine binary missing at ${ENGINE_BIN}; running "pnpm run build:engine"`);
}

const result = spawnSync("pnpm", ["run", "build:engine"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (typeof result.status === "number") {
  if (result.status !== 0) {
    console.error(
      `engine build failed with exit code ${result.status}. Fix build errors and rerun "pnpm run build:engine".`,
    );
  }
  process.exit(result.status);
}

if (result.error) {
  console.error(`engine build invocation failed: ${result.error.message}`);
}
process.exit(1);
