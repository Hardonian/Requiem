# Test Data Foundry

The Test Data Foundry is a deterministic, reproducible dataset generation system for testing the Requiem platform. It ensures that the same dataset code, version, and seed always produce identical outputs.

## Core Concepts

### Determinism

Determinism means that given the same inputs (dataset code, version, seed), the system always produces identical outputs. This is achieved through:

1. **Seeded RNG**: A custom PRNG (mulberry32 algorithm) that produces the same sequence from the same seed
2. **Canonical JSON**: Stable JSON serialization with sorted keys and normalized numbers
3. **Stable Hashing**: SHA-256 hashes over canonical JSON for dataset IDs
4. **Fixed Timestamps**: Timestamps are recorded once and then fixed (not re-generated on replay)

### Dataset Structure

Each dataset consists of:

- **Metadata**: code, name, description, version, schema_version, item_count, labels
- **Items**: The generated test data items (JSONL format)
- **Labels**: Labels for each item (JSONL format)
- **Manifest**: Run metadata, dataset metadata, file hashes

### Artifact Output

Artifacts are written to `./artifacts/<run_id>/`:

```
artifacts/<run_id>/
├── manifest.json    # Run metadata and file hashes
├── dataset.json     # Dataset metadata
├── items.jsonl      # Generated items (one per line)
├── labels.jsonl     # Labels for items
└── checks.json      # Validation check results
```

## Available Datasets

| Code | Name | Purpose |
|------|------|---------|
| `POL-TENANT-ISOLATION` | Tenant Isolation Policy Test | Cross-tenant read attempts (10 scenarios) |
| `POL-ROLE-ESCALATION` | Role Escalation Policy Test | Viewer attempting admin tasks (10 scenarios) |
| `TOOL-SCHEMA-STRESS` | Tool Schema Stress Test | Fuzzed tool arguments (50 cases) |
| `ADV-INJECT-BASIC` | Adversarial Injection Basic | Prompt injection vectors (20 variants) |
| `ADV-PATH-TRAVERSAL` | Adversarial Path Traversal | Path traversal attempts (20 variants) |
| `REPO-DAG-CIRCULAR` | Repository DAG Circular | Git DAG with cycle (1 case) |
| `CLI-PIPE-PRESSURE` | CLI Pipe Pressure Test | 10MB output stream stress (5 cases) |
| `PERF-COLD-START` | Performance Cold Start | Binary load latency baseline (5 runs) |
| `FAULT-OOM-SCENARIO` | Fault OOM Scenario | 100MB state-tree requests (5 scenarios) |
| `TRACE-ROUNDTRIP` | Trace Roundtrip Verification | Bit-parity verification (1 case) |

## CLI Commands

### List Datasets

```bash
# List all registered datasets
rl dataset list

# Output as JSON
rl dataset list --json
```

### Generate Dataset

```bash
# Generate dataset artifacts
rl dataset gen <CODE> --seed <n>

# Example
rl dataset gen POL-TENANT-ISOLATION --seed 1337
```

Options:
- `-s, --seed <number>`: Seed for deterministic generation (default: 1337)
- `-o, --out <path>`: Output directory (default: ./artifacts)
- `-t, --tenant <tenant>`: Tenant ID (default: public-hardonian)
- `-v, --version <number>`: Dataset version (default: 1)

### Validate Dataset

```bash
# Validate a generated dataset
rl dataset validate <CODE> --seed <n>

# Example
rl dataset validate POL-TENANT-ISOLATION --seed 1337
```

### Replay Dataset

```bash
# Replay a dataset run from artifacts
rl dataset replay <run_id>

# Example
rl dataset replay abc123def456
```

## Adding a New Dataset

1. Create a new file in `packages/testdata/src/datasets/`:

```typescript
// packages/testdata/src/datasets/my_new_dataset.ts

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

export const metadata: DatasetMetadata = {
  code: 'MY-NEW-DATASET',
  name: 'My New Dataset',
  description: 'Description of what this dataset tests',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 10,
  labels: {
    category: 'my-category',
    subtype: 'my-subtype',
  },
};

export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  case_id: string;
  // ... other fields
}> {
  for (let i = 0; i < 10; i++) {
    yield {
      case_id: `case-${i}`,
      // ... generate fields
    };
  }
}

export function validate(
  items: Record<string, unknown>[],
  _labels: Record<string, unknown>[]
): { valid: boolean; errors: any[]; warnings: any[] } {
  // Validate items
  return { valid: true, errors: [], warnings: [] };
}

export const dataset: RegisteredDataset = {
  metadata,
  generate,
  validate,
};
```

2. Register the dataset in `packages/testdata/src/datasets/index.ts`:

```typescript
import { dataset as myNewDataset } from './my_new_dataset.js';

// Add to registerAllDatasets()
registerDataset(myNewDataset);
```

3. Build and test:

```bash
pnpm build
rl dataset gen MY-NEW-DATASET --seed 1337
rl dataset validate MY-NEW-DATASET --seed 1337
```

## Tenant Isolation

**IMPORTANT**: The Test Data Foundry enforces tenant isolation:

- For CLI generators, tenant_id can only be specified via CLI config (default: `public-hardonian`)
- tenant_id must NEVER be accepted from request body in any API route
- All generated artifacts include the tenant_id for audit purposes

## Determinism Verification

To verify determinism, run the same generation twice and compare outputs:

```bash
# Generate twice with same seed
rl dataset gen POL-TENANT-ISOLATION --seed 1337 --out ./artifacts/run1
rl dataset gen POL-TENANT-ISOLATION --seed 1337 --out ./artifacts/run2

# Compare outputs (should be identical)
diff ./artifacts/run1/*/items.jsonl ./artifacts/run2/*/items.jsonl
diff ./artifacts/run1/*/labels.jsonl ./artifacts/run2/*/labels.jsonl
```

The CI workflow includes a determinism check that automatically verifies byte-identical outputs.

## Limitations

- **No DB persistence yet**: Currently artifacts are stored to filesystem only. A repository abstraction is planned for future DB integration.
- **Fixed timestamps**: For reproducibility, timestamps are fixed at generation time. This means replay won't reflect "current" time.
- **Validation is smoke-only**: Validators perform basic structural checks but don't integrate with actual API endpoints.
- **OOM tests are simulated**: The FAULT-OOM-SCENARIO dataset validates input parameters but doesn't actually allocate memory.
- **Performance tests are placeholders**: PERF-COLD-START generates test cases but the actual timing measurements require real CLI execution.

## Architecture

```
packages/testdata/
├── src/
│   ├── index.ts           # Main exports
│   ├── hash.ts            # SHA-256 hashing utilities
│   ├── canonical.ts        # Canonical JSON serialization
│   ├── rng.ts             # Seeded PRNG (mulberry32)
│   ├── registry.ts         # Dataset registry
│   ├── writer.ts          # Artifact writer
│   └── datasets/
│       ├── index.ts       # Dataset registration
│       ├── pol_tenant_isolation.ts
│       ├── pol_role_escalation.ts
│       └── ... (other datasets)
```

## Troubleshooting

### "Dataset not found"

Make sure the dataset is registered in `packages/testdata/src/datasets/index.ts` and the package is built.

### "Items differ between runs"

Check that:
1. The same seed is used
2. The RNG implementation hasn't changed
3. No non-deterministic operations (Date.now(), Math.random()) are used in the generator

### "TypeScript errors"

Ensure the testdata package is built and the CLI depends on it via workspace protocol.
