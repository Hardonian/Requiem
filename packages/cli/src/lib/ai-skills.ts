/**
 * AI Skills Registry Bridge
 * 
 * Provides CLI-accessible skill management.
 * These are simple in-memory registrations for CLI use.
 */

// Skill types
export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  steps: SkillStep[];
  precondition?: (ctx: any) => Promise<boolean>;
  postcondition?: (ctx: any, output: any) => Promise<boolean>;
}

export type SkillStep = 
  | { kind: 'tool'; toolName: string; input: any }
  | { kind: 'llm'; prompt: string }
  | { kind: 'assert'; condition: string };

const skillRegistry = new Map<string, SkillDefinition>();

/**
 * Registers a skill in CLI context
 */
export function registerSkill(definition: SkillDefinition): void {
  const key = `${definition.name}@${definition.version}`;
  if (skillRegistry.has(key)) {
    throw new Error(`Skill "${definition.name}@${definition.version}" already registered`);
  }
  skillRegistry.set(key, definition);
  console.log(`[SkillRegistry] Registered skill: ${key}`);
}

/**
 * Gets a skill by name (with optional version)
 */
export function getSkill(name: string, version?: string): SkillDefinition | undefined {
  if (version) {
    return skillRegistry.get(`${name}@${version}`);
  }

  // Find latest version
  let latest: SkillDefinition | undefined;
  let latestVersion = '0.0.0';

  for (const [key, skill] of skillRegistry.entries()) {
    if (key.startsWith(`${name}@`)) {
      const v = key.replace(`${name}@`, '');
      if (compareVersions(v, latestVersion) > 0) {
        latestVersion = v;
        latest = skill;
      }
    }
  }
  return latest;
}

/**
 * Lists all registered skills
 */
export function listSkills(): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

