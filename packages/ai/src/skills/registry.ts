/**
 * @fileoverview Skill registry — central store for versioned skill definitions.
 */

import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { now } from '../types/index';
import type { SkillDefinition } from './types';

const _registry = new Map<string, SkillDefinition>();

function skillKey(name: string, version: string): string {
  return `${name}@${version}`;
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

export function registerSkill(definition: SkillDefinition): void {
  const key = skillKey(definition.name, definition.version);
  if (_registry.has(key)) {
    throw new AiError({
      code: AiErrorCode.SKILL_ALREADY_REGISTERED,
      message: `Skill already registered: ${key}`,
      phase: 'skill.registry',
    });
  }
  _registry.set(key, definition);
}

export function getSkill(name: string, version?: string): SkillDefinition | undefined {
  if (version) return _registry.get(skillKey(name, version));

  let latest: SkillDefinition | undefined;
  let latestVer = '0.0.0';
  for (const [key, skill] of Array.from(_registry)) {
    if (key.startsWith(`${name}@`)) {
      if (compareVersions(skill.version, latestVer) > 0) {
        latestVer = skill.version;
        latest = skill;
      }
    }
  }
  return latest;
}

export function listSkills(): SkillDefinition[] {
  return Array.from(_registry.values());
}

export function getSkillCount(): number {
  return _registry.size;
}

export function _clearSkillRegistry(): void {
  _registry.clear();
}
