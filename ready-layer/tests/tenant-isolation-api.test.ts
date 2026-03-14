import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalEnv = { ...process.env };

function authHeaders(tenantId: string): Record<string, string> {
  return {
    authorization: "Bearer tenant-secret",
    "x-tenant-id": tenantId,
    "x-actor-id": `actor-${tenantId}`,
  };
}

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("tenant isolation enforcement on budget routes", () => {
  it("tenant A cannot read tenant B by query override", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REQUIEM_AUTH_SECRET: "tenant-secret",
    });
    const { GET } = await import("../src/app/api/budgets/route");

    const req = new NextRequest(
      "http://localhost/api/budgets?tenant=tenant-b",
      {
        headers: authHeaders("tenant-a"),
      },
    );
    const res = await GET(req);
    const body = (await res.json()) as {
      data?: { budget?: { tenant_id?: string } };
    };

    expect(res.status).toBe(200);
    expect(body.data?.budget?.tenant_id).toBe("tenant-a");
  }, 20000);

  it("tenant context is required for protected mutation", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REQUIEM_AUTH_SECRET: "tenant-secret",
    });
    const { POST } = await import("../src/app/api/budgets/route");

    const req = new NextRequest("http://localhost/api/budgets", {
      method: "POST",
      headers: {
        authorization: "Bearer tenant-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "reset-window" }),
    });
    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(body.code).toBe("missing_tenant_id");
  });

  it("malformed tenant context is rejected", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REQUIEM_AUTH_SECRET: "tenant-secret",
    });
    const { GET } = await import("../src/app/api/budgets/route");

    const req = new NextRequest("http://localhost/api/budgets", {
      headers: {
        authorization: "Bearer tenant-secret",
        "x-tenant-id": "   ",
      },
    });
    const res = await GET(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(body.code).toBe("missing_tenant_id");
  });

  it("demo surfaces are explicitly marked", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REQUIEM_AUTH_SECRET: "tenant-secret",
    });
    const { GET } = await import("../src/app/api/budgets/route");

    const req = new NextRequest("http://localhost/api/budgets", {
      headers: authHeaders("tenant-a"),
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-requiem-mode")).toBe("demo");
  });
});
