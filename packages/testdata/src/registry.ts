/**
 * Dataset registry - central registration for all test datasets.
 */

import type { CanonicalValue } from './canonical.js';
import type { SeededRNG } from './rng.js';

/**
 * Dataset metadata.
 */
export interface DatasetMetadata {
  code: string;
  name: string;
  description: string;
  version: number;
  schemaVersion: string;
  itemCount: number;
  labels: Record<string, string>;
}

/**
 * Single dataset item.
 */
export interface DatasetItem {
  [key: string]: CanonicalValue;
}

/**
 * Item label.
 */
export interface ItemLabel {
  [key: string]: CanonicalValue;
}

/**
 * Dataset validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error.
 */
export interface ValidationError {
  itemIndex: number;
  field: string;
  message: string;
}

/**
 * Validation warning.
 */
export interface ValidationWarning {
  itemIndex: number;
  field: string;
  message: string;
}

/**
 * Dataset generator function.
 */
export type DatasetGenerator = (
  rng: SeededRNG,
  seed: number,
  version: number
) => Generator<DatasetItem>;

/**
 * Dataset validator function.
 */
export type DatasetValidator = (
  items: DatasetItem[],
  labels: ItemLabel[]
) => ValidationResult;

/**
 * Registered dataset.
 */
export interface RegisteredDataset {
  metadata: DatasetMetadata;
  generate: DatasetGenerator;
  validate?: DatasetValidator;
}

/**
 * Global dataset registry.
 */
const registry = new Map<string, RegisteredDataset>();

/**
 * Register a dataset.
 */
export function registerDataset(dataset: RegisteredDataset): void {
  if (registry.has(dataset.metadata.code)) {
    throw new Error(
      `Dataset ${dataset.metadata.code} is already registered`
    );
  }
  registry.set(dataset.metadata.code, dataset);
}

/**
 * Get a dataset by code.
 */
export function getDataset(code: string): RegisteredDataset | undefined {
  return registry.get(code);
}

/**
 * List all registered datasets.
 */
export function listDatasets(): DatasetMetadata[] {
  return Array.from(registry.values()).map((d) => d.metadata);
}

/**
 * Check if a dataset is registered.
 */
export function hasDataset(code: string): boolean {
  return registry.has(code);
}

/**
 * Get all dataset codes.
 */
export function getDatasetCodes(): string[] {
  return Array.from(registry.keys());
}
