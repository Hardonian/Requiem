import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuditStore } from '../src/store/memory.js';

test('audit store is append only', async () => {
  const store = new MemoryAuditStore();
  await store.append({
    event_id: 'e1',
    tenant_id: 't1',
    actor_id: 'a1',
    request_id: 'r1',
    trace_id: 'tr1',
    event_type: 'RUN_CREATED',
    payload_hash: 'h1',
    payload: { a: 1 },
    created_at: new Date().toISOString(),
  });

  const page1 = await store.list();
  assert.equal(page1.items.length, 1);

  await store.append({
    ...page1.items[0],
    event_id: 'e2',
    payload: { a: 2 },
  });

  const page2 = await store.list();
  assert.equal(page2.items.length, 2);
  assert.deepEqual(page2.items[0].payload, { a: 1 });
});
