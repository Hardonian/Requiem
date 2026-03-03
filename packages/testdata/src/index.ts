/**
 * Test Data Foundry - Deterministic dataset generation framework.
 *
 * Provides:
 * - Stable hashing utilities
 * - Canonical JSON serialization
 * - Seeded RNG for reproducible generation
 * - Dataset registry
 * - Artifact writer
 */

// Core utilities
export * from './hash.js';
export * from './canonical.js';
export * from './rng.js';
export * from './registry.js';
export * from './writer.js';

// Datasets
export * from './datasets/index.js';

// Re-export types
export type { CanonicalValue } from './canonical.js';
export type {
  DatasetMetadata,
  DatasetItem,
  ItemLabel,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  RegisteredDataset,
  DatasetGenerator,
  DatasetValidator,
} from './registry.js';
export type {
  RunMetadata,
  Manifest,
  ArtifactFile,
  CheckResult,
} from './writer.js';
