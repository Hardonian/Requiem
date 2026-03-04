#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const apiRoot = path.join(root, 'ready-layer', 'src', 'app', 'api');

interface Finding { file: string; line: number; snippet: string; reason: string }

function listRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listRouteFiles(full));
    else if (entry.isFile() && entry.name === 'route.ts') files.push(full);
  }
  return files;
}

function findLine(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function main(): void {
  const files = listRouteFiles(apiRoot);
  const findings: Finding[] = [];

  const forbiddenPatterns: Array<{ regex: RegExp; reason: string }> = [
    { regex: /\btenant_id\s*:\s*body\./g, reason: 'tenant_id sourced from request body' },
    { regex: /\btenantId\s*:\s*body\./g, reason: 'tenantId sourced from request body' },
    { regex: /\bbody\.(tenant_id|tenantId)\b/g, reason: 'request body tenant field accessed directly' },
    { regex: /\{[^}]*\b(tenant_id|tenantId)\b[^}]*\}\s*=\s*body\b/g, reason: 'tenant field destructured from request body' },
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const { regex, reason } of forbiddenPatterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(source)) !== null) {
        const idx = match.index;
        const line = findLine(source, idx);
        const snippet = source.split('\n')[line - 1]?.trim() ?? '';
        findings.push({ file: path.relative(root, file), line, snippet, reason });
      }
    }
  }

  if (findings.length > 0) {
    console.error('verify-tenant-body failed: tenant fields must come from context, never request bodies.');
    for (const finding of findings) {
      console.error(`  - ${finding.file}:${finding.line} ${finding.reason}`);
      console.error(`      ${finding.snippet}`);
    }
    process.exit(1);
  }

  console.log(`verify-tenant-body passed (${files.length} route files checked)`);
}

main();
