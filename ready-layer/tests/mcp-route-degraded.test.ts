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
  degradedMessage: string;
  successHandlerName: 'GET_health' | 'GET_tools' | 'POST_callTool';
};

const routeSpecs: RouteSpec[] = [
  {
    name: 'mcp health route',
    modulePath: '../src/app/api/mcp/health/route',
    method: 'GET',
    url: 'http://localhost/api/mcp/health',
    degradedMessage: 'MCP service unavailable: initialization failed',
    successHandlerName: 'GET_health',
  },
  {
    name: 'mcp tools route',
    modulePath: '../src/app/api/mcp/tools/route',
    method: 'GET',
    url: 'http://localhost/api/mcp/tools',
    degradedMessage: 'MCP tools unavailable: initialization failed',
    successHandlerName: 'GET_tools',
  },
  {
    name: 'mcp call route',
    modulePath: '../src/app/api/mcp/tool/call/route',
    method: 'POST',
    url: 'http://localhost/api/mcp/tool/call',
    degradedMessage: 'MCP tool invocation unavailable: initialization failed',
    successHandlerName: 'POST_callTool',
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
      };

      expect(response.status).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.code).toBe('MCP_INIT_FAILED');
      expect(body.message).toBe(spec.degradedMessage);
      expect((body as Record<string, unknown>).error).toBeUndefined();
    });
  }
});

describe('MCP route healthy handling', () => {
  for (const spec of routeSpecs) {
    it(`${spec.name} returns delegated success response when initialization succeeds`, async () => {
      vi.doMock('@requiem/ai/bootstrap', () => ({}));

      const successBody = {
        ok: true,
        route: spec.name,
        delegated: spec.successHandlerName,
      };

      vi.doMock('@requiem/ai/mcp', () => ({
        GET_health: async () =>
          new Response(JSON.stringify(successBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        GET_tools: async () =>
          new Response(JSON.stringify(successBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        POST_callTool: async () =>
          new Response(JSON.stringify(successBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      }));

      const routeModule = (await import(spec.modulePath)) as Record<string, (request: Request) => Promise<Response>>;
      const handler = routeModule[spec.method];

      const response = await handler(new Request(spec.url, { method: spec.method }));
      const body = (await response.json()) as {
        ok: boolean;
        route: string;
        delegated: string;
      };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.route).toBe(spec.name);
      expect(body.delegated).toBe(spec.successHandlerName);
    });
  }
});
