import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("auth enforcement on protected API routes", () => {
  it("rejects unauthenticated access to protected route", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REQUIEM_AUTH_SECRET: "prod-secret",
    });
    const { GET } = await import("../src/app/api/budgets/route");

    const res = await GET(new NextRequest("http://localhost/api/budgets"));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body.code).toBe("missing_auth");
  });

  it("fails closed in production when auth secret is missing", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.REQUIEM_AUTH_SECRET;

    const { GET } = await import("../src/app/api/budgets/route");
    const req = new NextRequest("http://localhost/api/budgets", {
      headers: {
        authorization: "Bearer whatever",
        "x-tenant-id": "tenant-a",
      },
    });

    const res = await GET(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(503);
    expect(body.code).toBe("auth_secret_required");
  });

  it("allows authenticated flow on protected route", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REQUIEM_AUTH_SECRET: "prod-secret",
    });
    const { GET } = await import("../src/app/api/budgets/route");

    const req = new NextRequest("http://localhost/api/budgets", {
      headers: {
        authorization: "Bearer prod-secret",
        "x-tenant-id": "tenant-a",
      },
    });

    const res = await GET(req);
    const body = (await res.json()) as {
      data?: { budget?: { tenant_id?: string } };
    };

    expect(res.status).toBe(200);
    expect(body.data?.budget?.tenant_id).toBe("tenant-a");
  });
});
