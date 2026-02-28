/**
 * @fileoverview A registry for managing AI Skills.
 */

import { SkillDefinition, SkillDefinitionSchema } from './types';

/**
 * The in-memory store for all registered skills.
 * Skills are keyed by `name@version`.
 */
const skillRegistry = new Map<string, SkillDefinition>();

/**
 * Registers a new skill or a new version of an existing skill.
 *
 * @param definition The skill's formal definition.
 * @throws If a skill with the same name and version is already registered.
 */
export function registerSkill(definition: SkillDefinition): void {
  const key = `${definition.name}@${definition.version}`;
  if (skillRegistry.has(key)) {
    throw new Error(
      `Skill with name "${definition.name}" and version "${definition.version}" is already registered.`
    );
  }

  // Validate the definition
  const parsedDef = SkillDefinitionSchema.parse(definition);

  skillRegistry.set(key, parsedDef);
  console.log(`[SkillRegistry] Registered skill: ${key}`);
}

/**
 * Retrieves a registered skill by its name and optionally a specific version.
 *
 * @param name The name of the skill to retrieve.
 * @param version An optional semver version string. If omitted, the latest version is returned.
 * @returns The registered skill definition, or `undefined` if not found.
 */
export function getSkill(name: string, version?: string): SkillDefinition | undefined {
  if (version) {
    return skillRegistry.get(`${name}@${version}`);
  }

  // Find the latest version
  let latestSkill: SkillDefinition | undefined;
  let latestVersion = '0.0.0';

  for (const [key, skill] of skillRegistry.entries()) {
    if (key.startsWith(`${name}@`)) {
      if (compareVersions(skill.version, latestVersion) > 0) {
        latestVersion = skill.version;
        latestSkill = skill;
      }
    }
  }
  return latestSkill;
}

/**
 * Lists all registered skills.
 *
 * @returns An array of all registered skill definitions.
 */
export function listSkills(): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

/**
 * A simple semver comparator.
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}
