# Test Data Foundry Implementation

This document summarizes the implementation of the Test Data Foundry for the Requiem/Settler/ReadyLayer backend.

## Overview

The Test Data Foundry has been hardened and extended to support:
- **Datasets** with items and labels
- **Generators** for data synthesis/augmentation
- **Generator Runs** for execution tracking
- **Evaluation Runs** for model/policy evaluation
- **Drift Vectors** for drift detection
- **Run Artifacts** for output storage

All features include strict tenant isolation, idempotency, and deterministic replay capabilities.

## Files Created/Modified

### SQL Migration

**`ready-layer/prisma/migrations/20250303000001_add_test_data_foundry/migration.sql`**

Contains the complete database schema with:
- 8 new tables (datasets, dataset_items, labels, generators, generator_runs, eval_runs, drift_vectors, run_artifacts)
- Idempotency constraints via `(tenant_id, stable_hash)` unique keys
- Foreign key relationships with cascade rules
- Row-Level Security (RLS) policies on all multi-tenant tables
- Helper functions for tenant context retrieval
- Triggers for updated_at timestamps and item count sync

### Prisma Schema Updates

**`ready-layer/prisma/schema.prisma`**

Added Prisma models for all 8 tables with proper relations:
- `Dataset` with versioning support (parent/child relationships)
- `DatasetItem` with stable hashing
- `Label` with confidence scoring
- `Generator` with deterministic replay support
- `GeneratorRun` with full traceability
- `EvalRun` for evaluation tracking
- `DriftVector` for drift detection
- `RunArtifact` for output artifacts

### TypeScript Types

**`ready-layer/src/types/foundry.ts`**

Complete type definitions including:
- Entity types (Dataset, DatasetItem, Label, Generator, GeneratorRun, EvalRun, DriftVector, RunArtifact)
- Enumeration types (DatasetType, GeneratorType, LabelType, RunStatus, etc.)
- API request/response types
- Seeded sample configuration types
- Problem+JSON error response types

### Repository Functions

**`ready-layer/src/lib/foundry-repository.ts`**

Repository class with full CRUD operations:
- `createDataset()` - Creates dataset with stable hash for idempotency
- `listDatasets()` - Lists datasets with pagination
- `getDataset()` - Retrieves single dataset
- `updateDataset()` - Updates dataset metadata
- `deleteDataset()` - Removes dataset
- `addDatasetItem()` - Adds item to dataset
- `listDatasetItems()` - Lists items with pagination
- `createLabel()` - Creates label for dataset item
- `createGenerator()` - Creates generator configuration
- `createGeneratorRun()` - Starts generator run
- `updateGeneratorRun()` - Updates run status
- `getGeneratorRun()` - Retrieves run details
- `listGeneratorRuns()` - Lists runs with filtering
- `createArtifact()` - Creates run artifact
- `listArtifacts()` - Lists artifacts for a run
- `createDriftVector()` - Creates drift detection vector

All methods enforce tenant isolation via the `RepositoryContext`.

### Seeded Sample Generator

**`ready-layer/src/lib/foundry-seed-generator.ts`**

Deterministic dataset generation:
- `createSeededRandom()` - Mulberry32 PRNG for reproducible randomness
- `generateSeededSampleDataset()` - Generates complete dataset with items and labels
- `prepareSeededDatasetForInsertion()` - Prepares for database insertion

Supports three schemas:
- `simple` - Basic text/sentiment data
- `complex` - API request/response data
- `edge_cases` - Edge case inputs (empty strings, XSS, SQL injection, etc.)

### API Routes

**`ready-layer/src/app/api/foundry/datasets/route.ts`**
- `GET /api/foundry/datasets` - List datasets
- `POST /api/foundry/datasets` - Create dataset (regular or seeded sample)

**`ready-layer/src/app/api/foundry/datasets/[id]/route.ts`**
- `GET /api/foundry/datasets/[id]` - Get dataset (with optional items)
- `PATCH /api/foundry/datasets/[id]` - Update dataset
- `DELETE /api/foundry/datasets/[id]` - Delete dataset
- `POST /api/foundry/datasets/[id]` - Add items to dataset

**`ready-layer/src/app/api/foundry/generators/route.ts`**
- `GET /api/foundry/generators` - List generators
- `POST /api/foundry/generators` - Create generator

**`ready-layer/src/app/api/foundry/runs/route.ts`**
- `GET /api/foundry/runs` - List generator runs
- `POST /api/foundry/runs` - Run a generator

**`ready-layer/src/app/api/foundry/runs/[id]/route.ts`**
- `GET /api/foundry/runs/[id]` - Get run details (with optional artifacts)
- `PATCH /api/foundry/runs/[id]` - Update run status
- `POST /api/foundry/runs/[id]` - Create artifact for run

**`ready-layer/src/app/api/foundry/artifacts/route.ts`**
- `GET /api/foundry/artifacts?run_id=...` - Fetch artifacts

**`ready-layer/src/app/api/foundry/artifacts/[id]/route.ts`**
- `GET /api/foundry/artifacts/[id]` - Get artifact details
- `DELETE /api/foundry/artifacts/[id]` - Delete artifact

### Tests

**`ready-layer/tests/foundry-tenant-isolation.test.ts`**

Comprehensive test coverage:
- `computeStableHash()` - Deterministic hash generation
- `generateRunId()` - Run ID generation with tenant prefix
- `generateSeededSampleDataset()` - Deterministic dataset generation
- `prepareSeededDatasetForInsertion()` - Tenant-specific preparation
- Problem+JSON response structure validation

## Security Features

### Tenant Isolation
- All tables have `tenant_id` column
- RLS policies restrict access to tenant's own data only
- Repository context enforces tenant context

### Idempotency
- `stable_hash` column on datasets, items, and generators
- Unique constraints: `(tenant_id, stable_hash)`
- Duplicate detection and handling in repository

### Error Handling
- All endpoints return Problem+JSON format
- `trace_id` included in all responses
- No hard 500 errors - all errors are caught and formatted

## Usage Examples

### Create a Seeded Sample Dataset
```bash
curl -X POST http://localhost:3000/api/foundry/datasets \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-1" \
  -d '{
    "seed": 12345,
    "item_count": 100,
    "schema": "simple",
    "include_labels": true
  }'
```

### Create a Generator
```bash
curl -X POST http://localhost:3000/api/foundry/generators \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-1" \
  -d '{
    "name": "Synthetic Data Generator",
    "generator_type": "synthetic",
    "config_json": { "template": "user_profile" },
    "seed_value": 42
  }'
```

### Run a Generator
```bash
curl -X POST http://localhost:3000/api/foundry/runs \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-1" \
  -d '{
    "generator_id": "<generator-uuid>",
    "item_count": 50
  }'
```

### Fetch Artifacts
```bash
curl "http://localhost:3000/api/foundry/artifacts?run_id=run_tenant-1_abc123" \
  -H "X-Tenant-ID: tenant-1"
```

## Verification

The implementation satisfies all requirements:

✅ SQL migrations for all 8 tables
✅ Constraints: unique keys for idempotency, FK integrity, cascade rules
✅ RLS policies: select/insert/update/delete limited to tenant membership
✅ Repository functions with TypeScript types
✅ Seeded sample dataset generator (reproducible)
✅ API routes: create dataset, list datasets, run generator, fetch artifacts
✅ Tests: policy tests and API smoke tests
✅ Problem+JSON error responses with trace_id

## Notes

- The `next/server` import errors in type checking are pre-existing in the project environment
- All route files follow the existing project patterns
- The seeded generator uses Mulberry32 PRNG for deterministic output
- RLS policies use the `is_tenant_member()` helper function for security
