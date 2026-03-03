import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { canonicalJsonStringify, canonicalize } from '../canonical_json.js';
import { sha256 } from '../hash.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'TRACE-ROUNDTRIP',
  name: 'Trace Roundtrip',
  description: 'Bit parity over run -> receipt -> replay hashes',
  version: 1,
  schema_version: '1.0.0',
  item_count: 1,
  labels_schema: {
    category: 'trace',
    subtype: 'roundtrip_parity',
  },
} as const;

function hashCanonical(value: unknown): string {
  return sha256(canonicalJsonStringify(canonicalize(value as never)));
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: (ctx) => {
    const runSpec = {
      dataset_code: ctx.dataset_code,
      dataset_id: ctx.dataset_id,
      seed: ctx.seed,
      version: ctx.version,
      tenant_id: ctx.tenant_id,
      command: 'rl dataset gen TRACE-ROUNDTRIP',
    };
    const receipt = {
      run_spec: runSpec,
      trace_id: `${ctx.trace_id}_receipt`,
      recorded_at: ctx.recorded_at,
      status: 'ok',
    };
    const receiptHash = hashCanonical(receipt);
    const replay = {
      receipt_hash: receiptHash,
      replayed: true,
      trace_id: `${ctx.trace_id}_replay`,
    };
    const replayHash = hashCanonical(replay);

    const item: DatasetItem = {
      run_spec: runSpec as never,
      expected_receipt_hash: receiptHash,
      expected_replay_hash: replayHash,
    };

    return [item];
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels, ctx) => {
    const result = defaultValidationResult([
      {
        name: 'receipt_and_replay_hash_match_expected',
        passed: true,
        details: { scenarios: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const receipt = {
        run_spec: item.run_spec,
        trace_id: `${ctx.trace_id}_receipt`,
        recorded_at: ctx.recorded_at,
        status: 'ok',
      };
      const actualReceiptHash = hashCanonical(receipt);
      const replay = {
        receipt_hash: actualReceiptHash,
        replayed: true,
        trace_id: `${ctx.trace_id}_replay`,
      };
      const actualReplayHash = hashCanonical(replay);

      if (actualReceiptHash !== item.expected_receipt_hash) {
        fail(result, {
          item_index: index,
          field: 'expected_receipt_hash',
          message: 'Receipt hash mismatch',
        });
      }
      if (actualReplayHash !== item.expected_replay_hash) {
        fail(result, {
          item_index: index,
          field: 'expected_replay_hash',
          message: 'Replay hash mismatch',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
