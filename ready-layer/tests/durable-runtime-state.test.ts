import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;

const originalEnv = { ...process.env };
const tables: Record<string, Map<string, Row>> = {
  control_plane_state: new Map(),
  request_idempotency: new Map(),
  rate_limit_buckets: new Map(),
};

function resetTables(): void {
  for (const table of Object.values(tables)) {
    table.clear();
  }
}

function primaryKeyFor(table: string, row: Row): string {
  if (table === 'control_plane_state') return String(row.tenant_id);
  return String(row.scope_key);
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([field, value]) => row[field] === value);
}

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private payload: Row | null = null;
  private mode: 'select' | 'insert' | 'update' = 'select';
  private wantsSingle: 'many' | 'single' | 'maybe' = 'many';

  constructor(private readonly table: string) {}

  select(): this {
    this.mode = 'select';
    return this;
  }

  insert(payload: Row): this {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = 'update';
    this.payload = payload;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push([field, value]);
    return this;
  }

  maybeSingle(): Promise<{ data: Row | null; error: { code: string } | null }> {
    this.wantsSingle = 'maybe';
    return this.execute();
  }

  single(): Promise<{ data: Row | null; error: { code: string } | null }> {
    this.wantsSingle = 'single';
    return this.execute();
  }

  then<TResult1 = { data: Row | null; error: { code: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row | null; error: { code: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute(): Promise<{ data: Row | null; error: { code: string } | null }> {
    const table = tables[this.table];
    if (!table) {
      throw new Error(`unknown table ${this.table}`);
    }

    if (this.mode === 'insert') {
      const row = { ...(this.payload ?? {}) };
      const key = primaryKeyFor(this.table, row);
      if (table.has(key)) {
        return { data: null, error: { code: '23505' } };
      }
      table.set(key, row);
      return { data: row, error: null };
    }

    if (this.mode === 'update') {
      const rows = [...table.values()].filter((row) => matches(row, this.filters));
      if (rows.length === 0) {
        return { data: null, error: null };
      }
      const next = { ...rows[0], ...(this.payload ?? {}) };
      table.set(primaryKeyFor(this.table, next), next);
      return { data: next, error: null };
    }

    const rows = [...table.values()].filter((row) => matches(row, this.filters));
    if (this.wantsSingle === 'single' && rows.length === 0) {
      return { data: null, error: { code: 'PGRST116' } };
    }
    if ((this.wantsSingle === 'single' || this.wantsSingle === 'maybe')) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: (rows as unknown as Row) ?? null, error: null };
  }
}

const fakeClient = {
  from(table: string) {
    return new FakeQuery(table);
  },
};

vi.mock('../src/lib/supabase-service', () => ({
  getSupabaseServiceClient: () => fakeClient,
  isSupabaseServiceConfigured: () => true,
  assertSupabaseServiceConfigured: () => undefined,
  resetSupabaseServiceClientForTests: () => undefined,
}));

beforeEach(() => {
  resetTables();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    REQUIEM_AUTH_SECRET: 'prod-secret',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  };
});

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('durable shared runtime state', () => {
  it('persists control-plane state across module reloads', async () => {
    const storeA = await import('../src/lib/control-plane-store');
    await storeA.setBudgetLimit('tenant-a', 'actor-a', 'exec', 321);

    vi.resetModules();
    const storeB = await import('../src/lib/control-plane-store');
    const budget = await storeB.getBudget('tenant-a');

    expect(budget.budgets.exec?.limit).toBe(321);
  });

  it('replays idempotent writes after module reload without re-running the handler', async () => {
    let executions = 0;

    const invoke = async () => {
      const { withTenantContext } = await import('../src/lib/big4-http');
      return withTenantContext(
        new NextRequest('http://localhost/api/durable-idempotency', {
          method: 'POST',
          headers: {
            authorization: 'Bearer prod-secret',
            'x-tenant-id': 'tenant-a',
            'content-type': 'application/json',
            'idempotency-key': 'same-key',
          },
          body: JSON.stringify({ action: 'mutate' }),
        }),
        async () => {
          executions += 1;
          return Response.json({ ok: true, executions });
        },
        async () => ({ allow: true, reasons: [] }),
        { idempotency: { required: true } },
      );
    };

    const first = await invoke();
    expect(first.status).toBe(200);
    expect(executions).toBe(1);

    vi.resetModules();
    const second = await invoke();
    expect(second.status).toBe(200);
    expect(second.headers.get('x-idempotency-replayed')).toBe('1');
    expect(second.headers.get('x-requiem-idempotency-scope')).toBe('durable-shared');
    expect(executions).toBe(1);
  });
});
