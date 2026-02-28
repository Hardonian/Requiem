import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RequiemWrapper } from './wrapper';
import { DecisionRepository } from './decisions';

describe('RequiemWrapper', () => {
  it('should intercept calls and attach correlation_id', async () => {
    // 1. Setup Mock Client
    const mockResponse = {
      id: 'chatcmpl-123',
      choices: [{ message: { content: 'Hello' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    };

    const mockClient = {
      chat: {
        completions: {
          create: async (_params: any) => {
            return mockResponse;
          }
        }
      }
    };

    // 2. Initialize Wrapper
    const tenantId = 'test-tenant-id';
    const wrapper = new RequiemWrapper(mockClient, { tenantId, persist: true });

    // 3. Execute Call
    const result = await wrapper.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }]
    });

    // 4. Verify Interception
    assert.ok(result.correlation_id, 'correlation_id should be generated');
    assert.strictEqual(typeof result.correlation_id, 'string');

    // 5. Verify Metadata
    assert.ok(result.requiem_meta, 'requiem_meta should be attached');
    assert.strictEqual(result.requiem_meta.tenant_id, tenantId);
    assert.strictEqual(result.requiem_meta.verified, true);
    assert.ok(result.requiem_meta.latency_ms >= 0, 'latency should be recorded');

    // 6. Verify Usage Propagation
    assert.deepStrictEqual(result.requiem_meta.usage, mockResponse.usage);

    // 7. Verify Persistence
    const decisions = DecisionRepository.list({ tenantId });
    assert.strictEqual(decisions.length, 1, 'Should persist one decision record');
    const record = decisions[0];
    assert.strictEqual(record.source_type, 'llm_client');
    assert.strictEqual(JSON.parse(record.decision_input).model, 'gpt-4');
  });

  it('should handle missing usage in response', async () => {
    const mockClient = {
      chat: { completions: { create: async () => ({ id: '123' }) } }
    };

    const wrapper = new RequiemWrapper(mockClient, { tenantId: 'test' });
    const result = await wrapper.chat.completions.create({});

    assert.ok(result.requiem_meta.usage, 'usage should be defaulted if missing');
    assert.strictEqual(result.requiem_meta.usage.total_tokens, 0);
  });
});
