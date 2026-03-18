import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

function authHeaders(): Record<string, string> {
  return {
    authorization: 'Bearer prod-secret',
    'x-tenant-id': 'tenant-a',
    'content-type': 'application/json',
  };
}

describe('foundry mutation abuse guards', () => {
  it('requires Idempotency-Key for dataset creation', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    });

    const { POST } = await import('../src/app/api/foundry/datasets/route');
    const req = new NextRequest('http://localhost/api/foundry/datasets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'critical-dataset' }),
    });

    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(body.code).toBe('missing_idempotency_key');
  });

  it('requires Idempotency-Key for generator run creation', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    });

    const { POST } = await import('../src/app/api/foundry/runs/route');
    const req = new NextRequest('http://localhost/api/foundry/runs', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ generator_id: crypto.randomUUID() }),
    });

    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(body.code).toBe('missing_idempotency_key');
  });
});
