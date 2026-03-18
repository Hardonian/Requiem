import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");
const pagePath = path.join(repoRoot, "src/app/console/snapshots/page.tsx");

describe("console snapshots action-truth semantics", () => {
  const source = fs.readFileSync(pagePath, "utf-8");

  it("requires explicit confirmation before restore requests are submitted", () => {
    expect(source).toContain(
      "This replaces tenant-local budget and capability state with the snapshot contents.",
    );
    expect(source).toContain('action: "restore"');
    expect(source).toContain("snapshot_hash: hash");
    expect(source).toContain("force: true");
  });

  it("exposes create and restore actions as live controls", () => {
    expect(source).toContain("Create snapshot");
    expect(source).toContain("Restoring...");
    expect(source).toContain("Snapshot operation complete");
  });
});
