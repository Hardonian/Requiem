import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unmock('@requiem/ai/bootstrap');
  vi.unmock('@requiem/ai/mcp');
});

type RouteSpec = {
  name: string;
  modulePath: string;
  method: 'GET' | 'POST';
  url: string;
  expectedMessage: string;
};

const routeSpecs: RouteSpec[] = [
  {
    name: 'mcp health route',
    modulePath: '../src/app/api/mcp/health/route',
    method: 'GET',
    url: 'http://localhost/api/mcp/health',
    expectedMessage: 'MCP service unavailable: initialization failed',
  },
  {
    name: 'mcp tools route',
    modulePath: '../src/app/api/mcp/tools/route',
    method: 'GET',
    url: 'http://localhost/api/mcp/tools',
    expectedMessage: 'MCP tools unavailable: initialization failed',
  },
  {
    name: 'mcp call route',
    modulePath: '../src/app/api/mcp/tool/call/route',
    method: 'POST',
    url: 'http://localhost/api/mcp/tool/call',
    expectedMessage: 'MCP tool invocation unavailable: initialization failed',
  },
];

describe('MCP route degraded-mode handling', () => {
  for (const spec of routeSpecs) {
    it(`${spec.name} returns MCP_INIT_FAILED envelope with HTTP 503 when bootstrap fails`, async () => {
      vi.doMock('@requiem/ai/bootstrap', () => ({}));
      vi.doMock('@requiem/ai/mcp', () => ({
        GET_health: async () => {
          throw new Error('bootstrap unavailable in test');
        },
        GET_tools: async () => {
          throw new Error('bootstrap unavailable in test');
        },
        POST_callTool: async () => {
          throw new Error('bootstrap unavailable in test');
        },
      }));

      const routeModule = (await import(spec.modulePath)) as Record<string, (request: Request) => Promise<Response>>;
      const handler = routeModule[spec.method];

      expect(typeof handler).toBe('function');

      const response = await handler(new Request(spec.url, { method: spec.method }));
      const body = (await response.json()) as {
        ok: boolean;
        code: string;
        message: string;
        error: string;
      };

      expect(response.status).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.code).toBe('MCP_INIT_FAILED');
      expect(body.message).toBe(spec.expectedMessage);
      expect(body.error).toContain('bootstrap unavailable in test');
    });
  }
});
