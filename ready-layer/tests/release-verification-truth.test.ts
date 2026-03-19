import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')) as Record<string, unknown>;
}

describe('release verification truth', () => {
  it('wires canonical route parity checks into verify:routes', () => {
    const packageJson = readJson('package.json');
    const scripts = packageJson.scripts as Record<string, string>;

    expect(scripts['verify:routes']).toContain('verify:routes-runtime');
    expect(scripts['verify:routes']).toContain('verify:route-parity');
    expect(scripts['verify:route-parity']).toContain('openapi-route-parity.test.ts');
    expect(scripts['verify:routes']).toContain('verify:route-maturity');
  });

  it('defines a canonical release verification command and documents it consistently', () => {
    const packageJson = readJson('package.json');
    const scripts = packageJson.scripts as Record<string, string>;
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
    const deploymentDoc = fs.readFileSync(path.join(repoRoot, 'docs/DEPLOYMENT.md'), 'utf8');
    const runbook = fs.readFileSync(path.join(repoRoot, 'docs/OPERATOR_RUNBOOK.md'), 'utf8');

    expect(scripts['verify:release']).toBeTruthy();
    expect(readme).toContain('pnpm run verify:release');
    expect(deploymentDoc).toContain('pnpm run verify:release');
    expect(runbook).toContain('pnpm run verify:release');
  });
});
