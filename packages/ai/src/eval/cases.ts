/**
 * @fileoverview Evaluation case types and loader.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvalMethod = 'exact_match' | 'schema_valid' | 'contains' | 'custom';

export interface EvalCase {
  id: string;
  description: string;
  skill?: string;
  tool?: string;
  input: unknown;
  expected?: unknown;
  evalMethod: EvalMethod;
  requiredKeys?: string[];
  tags?: string[];
}

export interface EvalGolden {
  caseId: string;
  expectedOutput: unknown;
  createdAt: string;
  version: string;
}

// ─── Case Loader ──────────────────────────────────────────────────────────────

export function loadEvalCases(casesDir?: string): EvalCase[] {
  const dir = casesDir ?? join(process.cwd(), 'eval', 'cases');
  if (!existsSync(dir)) return [];

  const cases: EvalCase[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { cases?: EvalCase[] } | EvalCase[];
      if (Array.isArray(data)) {
        cases.push(...data);
      } else if (data.cases) {
        cases.push(...data.cases);
      }
    }
  } catch { /* non-fatal */ }
  return cases;
}

export function loadGoldens(goldensDir?: string): Map<string, EvalGolden> {
  const dir = goldensDir ?? join(process.cwd(), 'eval', 'goldens');
  const goldens = new Map<string, EvalGolden>();

  if (!existsSync(dir)) return goldens;

  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as EvalGolden;
      goldens.set(data.caseId, data);
    }
  } catch { /* non-fatal */ }

  return goldens;
}
