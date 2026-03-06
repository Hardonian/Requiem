#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const apiRoot = path.join(root, 'ready-layer', 'src', 'app', 'api');

interface Violation { file: string; message: string }

const allowedWithoutTenantContext = new Set([
  'status/route.ts',
  'mcp/health/route.ts',
  'mcp/tools/route.ts',
  'mcp/tool/call/route.ts',
]);

function listRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(full));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      files.push(full);
    }
  }
  return files;
}

function main(): void {
  const violations: Violation[] = [];
  const files = listRouteFiles(apiRoot);

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(apiRoot, file).replace(/\\/g, '/');
    const hasTenantContext = source.includes('withTenantContext(');
    const hasProblemType = source.includes('application/problem+json') || source.includes('unknownErrorToProblem(');
    const hasTraceId = source.includes('trace_id') || source.includes('x-trace-id');

    if (!hasTenantContext && !allowedWithoutTenantContext.has(rel)) {
      violations.push({
        file: rel,
        message: 'Route does not use withTenantContext and is not in allowlist.',
      });
    }

    if (!hasTenantContext) {
      if (!hasProblemType) {
        violations.push({
          file: rel,
          message: 'Non-withTenantContext route must explicitly emit application/problem+json for error paths.',
        });
      }
      if (!hasTraceId) {
        violations.push({ file: rel, message: 'Route must propagate trace_id/x-trace-id in error responses.' });
      }
    }
  }

  if (violations.length > 0) {
    console.error('verify-problem-json failed:');
    for (const violation of violations) {
      console.error(`  - ${violation.file}: ${violation.message}`);
    }
    process.exit(1);
  }

  console.log(`verify-problem-json passed (${files.length} route files checked)`);
}

main();
