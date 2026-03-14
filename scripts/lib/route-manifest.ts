import fs from "node:fs";
import path from "node:path";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type ManifestRoute = {
  path: string;
  method: HttpMethod;
  file: string;
  auth_required: boolean;
  surface?: "public" | "protected" | "api" | "webhook" | "internal";
  probe?: boolean;
  description: string;
};

export type RouteManifest = {
  manifest_version: string;
  generated_at: string;
  routes: ManifestRoute[];
};

const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const PUBLIC_ROUTES = new Set([
  "/api/health",
  "/api/openapi.json",
  "/api/status",
  "/api/mcp/health",
]);

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function toRoutePath(file: string, apiRoot: string): string {
  const rel = path.relative(apiRoot, path.dirname(file)).replace(/\\/g, "/");
  return rel === "" ? "/api" : `/api/${rel}`;
}

function methodsFromSource(source: string): HttpMethod[] {
  return METHODS.filter((m) =>
    new RegExp(`export\\s+async\\s+function\\s+${m}\\s*\\(`).test(source),
  );
}

function descriptionFromPath(routePath: string, method: HttpMethod): string {
  return `${method} ${routePath} handler`;
}

export function generateRouteManifest(repoRoot = process.cwd()): RouteManifest {
  const apiRoot = path.join(repoRoot, "ready-layer", "src", "app", "api");
  const files = walk(apiRoot).filter(
    (file) => file.endsWith("/route.ts") || file.endsWith("\\route.ts"),
  );

  const routes: ManifestRoute[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const routePath = toRoutePath(file, apiRoot);
    const methods = methodsFromSource(source);
    for (const method of methods) {
      routes.push({
        path: routePath,
        method,
        file: path.relative(repoRoot, file).replace(/\\/g, "/"),
        auth_required: !PUBLIC_ROUTES.has(routePath),
        ...(routePath === "/api/health" || routePath === "/api/mcp/health"
          ? { probe: true }
          : {}),
        description: descriptionFromPath(routePath, method),
      });
    }
  }

  routes.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
  return {
    manifest_version: "2.0.0",
    generated_at: new Date().toISOString(),
    routes,
  };
}

export function readRouteManifest(manifestPath: string): RouteManifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as RouteManifest;
}
