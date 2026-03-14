#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { generateRouteManifest } from "./lib/route-manifest";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "routes.manifest.json");

function classifyRoute(
  pathname: string,
): "public" | "protected" | "api" | "webhook" | "internal" {
  if (pathname.includes("/webhook")) return "webhook";
  if (pathname.startsWith("/api/internal") || pathname.startsWith("/api/mcp"))
    return "internal";
  if (pathname.startsWith("/api/")) return "api";
  return "protected";
}

function main(): void {
  const manifest = generateRouteManifest(repoRoot);
  const normalized = {
    ...manifest,
    routes: manifest.routes.map((route) => ({
      ...route,
      surface: route.auth_required ? classifyRoute(route.path) : "public",
    })),
  };

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );

  const counts = normalized.routes.reduce<Record<string, number>>(
    (acc, route) => {
      acc[route.surface] = (acc[route.surface] ?? 0) + 1;
      return acc;
    },
    {},
  );

  console.log(
    `generated ${path.relative(repoRoot, outputPath)} (${normalized.routes.length} routes)`,
  );
  console.log(`surface counts: ${JSON.stringify(counts)}`);
}

main();
