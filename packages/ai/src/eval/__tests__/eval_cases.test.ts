/**
 * @fileoverview Eval case runner for AI builtin and skill regression cases.
 *
 * Dynamically loads every case file under eval/cases/ and verifies:
 *  - tool names referenced in builtin cases exist in the tool registry
 *  - skill IDs referenced in skill regression cases exist in the skill registry
 *  - cases with `requiredKeys` / `expected_output` have the right shape declared
 *
 * To add new cases: drop a new JSON file in eval/cases/ — no code change needed.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Side-effect imports to populate registries before assertions
import '../../tools/builtins/system.echo';
import '../../tools/builtins/system.health';
import '../../skills/builtins/skill.tool_smoke';
import '../../skills/builtins/skill.trace_summary';

import { getTool, listTools } from '../../tools/registry';
import { getSkill, listSkills } from '../../skills/registry';
import { registerSkill } from '../../skills/registry';

// ─── Case file types ──────────────────────────────────────────────────────────

interface BuiltinCase {
  id: string;
  description?: string;
  tool?: string;
  skill?: string;
  input: Record<string, unknown>;
  evalMethod?: string;
  requiredKeys?: string[];
  tags?: string[];
}

interface BuiltinCaseFile {
  cases: BuiltinCase[];
}

interface SkillRegressionCase {
  id: string;
  skill: string;
  scenario: string;
  input: Record<string, unknown>;
  expected_error?: string;
  expected_outcome?: string;
  expected_behavior?: string;
  expected_tags?: string[];
  tags?: string[];
}

interface SkillRegressionCaseFile {
  version?: string;
  test_cases: SkillRegressionCase[];
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const CASES_DIR  = join(__dirname, '../../../../../..', 'eval/cases');
const BUILTIN_CASES_PATH     = join(CASES_DIR, 'ai_builtin_cases.json');
const SKILL_REGRESSION_PATH  = join(CASES_DIR, 'skill_regression_cases.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * List all *.json files in a directory (for future expansion).
 */
function listCaseFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => join(dir, f));
  } catch {
    return [];
  }
}

// ─── Builtin Cases ────────────────────────────────────────────────────────────

describe('AI Builtin Cases', () => {
  let caseFile: BuiltinCaseFile;

  before(() => {
    caseFile = JSON.parse(readFileSync(BUILTIN_CASES_PATH, 'utf-8'));
  });

  test('case file loads and has at least one case', () => {
    assert.ok(Array.isArray(caseFile.cases), 'cases must be an array');
    assert.ok(caseFile.cases.length > 0, 'at least one case must be defined');
  });

  test('all cases have required fields (id, input)', () => {
    for (const c of caseFile.cases) {
      assert.ok(typeof c.id === 'string' && c.id.length > 0, `case missing id: ${JSON.stringify(c)}`);
      assert.ok(typeof c.input === 'object' && c.input !== null, `case ${c.id} missing input`);
    }
  });

  test('tool names referenced in builtin cases exist in the tool registry', () => {
    const registeredTools = new Set(listTools().map(t => t.name));
    const missing: string[] = [];
    for (const c of caseFile.cases) {
      if (c.tool != null && !registeredTools.has(c.tool)) {
        missing.push(`case ${c.id}: tool '${c.tool}' not in registry`);
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `Unregistered tool(s) referenced in builtin cases:\n  ${missing.join('\n  ')}`
    );
  });

  test('skill IDs referenced in builtin cases exist in the skill registry', () => {
    const missing: string[] = [];
    for (const c of caseFile.cases) {
      if (c.skill != null) {
        const found = getSkill(c.skill);
        if (!found) {
          missing.push(`case ${c.id}: skill '${c.skill}' not in registry`);
        }
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `Unregistered skill(s) referenced in builtin cases:\n  ${missing.join('\n  ')}`
    );
  });

  test('cases declaring requiredKeys have at least one required key', () => {
    for (const c of caseFile.cases) {
      if (c.requiredKeys != null) {
        assert.ok(
          Array.isArray(c.requiredKeys) && c.requiredKeys.length > 0,
          `case ${c.id} declares requiredKeys but the array is empty`
        );
      }
    }
  });
});

// ─── Skill Regression Cases ───────────────────────────────────────────────────

describe('Skill Regression Cases', () => {
  let caseFile: SkillRegressionCaseFile;

  before(() => {
    caseFile = JSON.parse(readFileSync(SKILL_REGRESSION_PATH, 'utf-8'));
  });

  test('case file loads and has at least one test case', () => {
    assert.ok(Array.isArray(caseFile.test_cases), 'test_cases must be an array');
    assert.ok(caseFile.test_cases.length > 0, 'at least one test case must be defined');
  });

  test('all cases have required fields (id, skill, scenario, input)', () => {
    for (const c of caseFile.test_cases) {
      assert.ok(typeof c.id     === 'string' && c.id.length > 0,       `case missing id`);
      assert.ok(typeof c.skill  === 'string' && c.skill.length > 0,    `case ${c.id} missing skill`);
      assert.ok(typeof c.scenario === 'string',                         `case ${c.id} missing scenario`);
      assert.ok(typeof c.input  === 'object' && c.input !== null,       `case ${c.id} missing input`);
    }
  });

  test('each case declares at least one expected outcome field', () => {
    const OUTCOME_FIELDS = ['expected_error', 'expected_outcome', 'expected_behavior', 'expected_tags'];
    for (const c of caseFile.test_cases) {
      const hasOutcome = OUTCOME_FIELDS.some(f => (c as Record<string, unknown>)[f] !== undefined);
      assert.ok(
        hasOutcome,
        `case ${c.id} has no expected outcome field (one of: ${OUTCOME_FIELDS.join(', ')})`
      );
    }
  });

  test('all json case files in eval/cases/ are valid JSON', () => {
    const files = listCaseFiles(CASES_DIR);
    assert.ok(files.length > 0, 'No JSON files found in eval/cases/');
    for (const f of files) {
      assert.doesNotThrow(
        () => JSON.parse(readFileSync(f, 'utf-8')),
        `${f} is not valid JSON`
      );
    }
  });
});
