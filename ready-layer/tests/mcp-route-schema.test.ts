import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unmock('@requiem/ai/bootstrap');
  vi.unmock('@requiem/ai/mcp');
  delete process.env.REQUIEM_DEV_MODE;
  delete process.env.REQUIEM_JWT_SECRET;
  delete process.env.REQUIEM_AUTH_SECRET;
});

describe('MCP route real-handler schema contracts', () => {
  it('GET /api/mcp/health returns typed health envelope', async () => {
    process.env.REQUIEM_DEV_MODE = '1';

    const { GET } = await import('../src/app/api/mcp/health/route');
    const response = await GET(new Request('http://localhost/api/mcp/health'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const data = body.data as Record<string, unknown> | undefined;
    expect(data).toBeDefined();
    expect(data?.status).toBe('ok');
    expect(typeof data?.tool_count).toBe('number');
    expect(typeof data?.version).toBe('string');
    expect(typeof data?.request_count).toBe('number');
  });

  it('GET /api/mcp/tools returns tools/list envelope with descriptors', async () => {
    process.env.REQUIEM_DEV_MODE = '1';

    const { GET } = await import('../src/app/api/mcp/tools/route');
    const response = await GET(new Request('http://localhost/api/mcp/tools'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const data = body.data as Record<string, unknown> | undefined;
    const tools = data?.tools as Array<Record<string, unknown>> | undefined;

    expect(Array.isArray(tools)).toBe(true);
    if ((tools?.length ?? 0) > 0) {
      const first = tools?.[0];
      expect(typeof first?.name).toBe('string');
      expect(typeof first?.version).toBe('string');
      expect(typeof first?.description).toBe('string');
      expect(typeof first?.sideEffect).toBe('boolean');
      expect(typeof first?.tenantScoped).toBe('boolean');
      expect(Array.isArray(first?.requiredCapabilities)).toBe(true);
    }
  });

  it('POST /api/mcp/tool/call returns typed call envelope for valid deterministic tool', async () => {
    process.env.REQUIEM_DEV_MODE = '1';

    const { POST } = await import('../src/app/api/mcp/tool/call/route');
    const response = await POST(
      new Request('http://localhost/api/mcp/tool/call', {
        method: 'POST',
        body: JSON.stringify({ toolName: 'system.health', arguments: {} }),
        headers: { 'content-type': 'application/json' },
      })
    );

    const body = (await response.json()) as Record<string, unknown>;

    expect([200, 400, 403, 404, 429, 500]).toContain(response.status);
    expect(typeof body.ok).toBe('boolean');

    if (body.ok === true) {
      expect(typeof body.trace_id).toBe('string');
      const data = body.data as Record<string, unknown> | undefined;
      expect(data).toBeDefined();
      expect(typeof data?.latencyMs).toBe('number');
      expect(typeof data?.toolVersion).toBe('string');
      expect(data?.content).toBeDefined();
    } else {
      const error = body.error as Record<string, unknown> | undefined;
      expect(error).toBeDefined();
      expect(typeof error?.code).toBe('string');
      expect(typeof error?.message).toBe('string');
      expect(typeof error?.retryable).toBe('boolean');
    }
  });
});
