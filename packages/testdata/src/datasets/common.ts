import { canonicalJsonStringify, canonicalize } from '../canonical_json.js';
import { sha256 } from '../hash.js';
import type {
  CanonicalValue,
  DatasetItem,
  DatasetLabel,
  GenerationContext,
  ValidationIssue,
  ValidationResult,
} from '../registry.js';

export function defaultValidationResult(checks: ValidationResult['checks']): ValidationResult {
  return { valid: true, errors: [], warnings: [], checks };
}

export function fail(
  state: ValidationResult,
  issue: ValidationIssue,
): void {
  state.valid = false;
  state.errors.push(issue);
}

export function labelFromSchema(schema: Record<string, CanonicalValue>): DatasetLabel {
  return { ...schema };
}

export function stableHashForItem(item: DatasetItem): string {
  return sha256(canonicalJsonStringify(canonicalize(item))).slice(0, 16);
}

export function ensureProblemJsonShape(problem: Record<string, CanonicalValue>): boolean {
  return (
    typeof problem.type === 'string' &&
    typeof problem.title === 'string' &&
    typeof problem.status === 'number' &&
    typeof problem.code === 'string' &&
    typeof problem.trace_id === 'string'
  );
}

export function expectedTrace(ctx: GenerationContext, suffix: string): string {
  return `${ctx.trace_id}_${suffix}`;
}
