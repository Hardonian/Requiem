import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

const appApiRoot = path.resolve(process.cwd(), 'src/app/api');

function routeFileForPath(apiPath: string): string {
  const suffix = apiPath.replace(/^\/api\/?/, '');
  return path.join(appApiRoot, suffix, 'route.ts');
}

function methodsInRoute(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  return [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g)].map((m) => m[1]);
}

describe('OpenAPI parity', () => {
  it('documents only implemented routes and methods', async () => {
    const { GET } = await import('../src/app/api/openapi.json/route');
    const response = await GET(new NextRequest('http://localhost/api/openapi.json'));
    const spec = (await response.json()) as { paths: Record<string, Record<string, unknown>> };

    const paths = Object.keys(spec.paths);
    expect(paths.length).toBeGreaterThan(0);

    for (const apiPath of paths) {
      const routeFile = routeFileForPath(apiPath);
      expect(fs.existsSync(routeFile), `${apiPath} missing route.ts`).toBe(true);

      const implementedMethods = methodsInRoute(routeFile);
      const documentedMethods = Object.keys(spec.paths[apiPath]).map((m) => m.toUpperCase());

      for (const method of documentedMethods) {
        expect(implementedMethods, `${apiPath} missing ${method} handler export`).toContain(method);
      }
    }
  });
});
