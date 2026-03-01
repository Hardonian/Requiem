#!/usr/bin/env node
/**
 * verify:skills
 * 
 * Validates skill registry:
 * - Enforces required fields
 * - Rejects duplicate IDs
 * - Rejects missing rollback instructions
 */

import fs from 'fs';
import path from 'path';

const SKILLS_DIR = 'skills';
const REGISTRY_FILE = 'skills/registry.json';

function validateSkill(skill, filePath) {
  const errors = [];
  
  // Required fields
  if (!skill.id) errors.push(`${filePath}: Missing required field: id`);
  if (!skill.scope) errors.push(`${filePath}: Missing required field: scope`);
  if (!skill.triggers || skill.triggers.length === 0) {
    errors.push(`${filePath}: Missing required field: triggers`);
  }
  if (!skill.required_inputs) errors.push(`${filePath}: Missing required field: required_inputs`);
  if (!skill.expected_outputs) errors.push(`${filePath}: Missing required field: expected_outputs`);
  if (!skill.verification_steps || skill.verification_steps.length === 0) {
    errors.push(`${filePath}: Missing required field: verification_steps`);
  }
  if (!skill.rollback_instructions) {
    errors.push(`${filePath}: Missing required field: rollback_instructions`);
  } else if (skill.rollback_instructions.length < 10) {
    errors.push(`${filePath}: rollback_instructions must be at least 10 characters`);
  }
  if (!skill.version) errors.push(`${filePath}: Missing required field: version`);
  
  // Valid scope
  if (skill.scope && !['execution', 'verification', 'policy'].includes(skill.scope)) {
    errors.push(`${filePath}: Invalid scope: ${skill.scope}`);
  }
  
  // Valid triggers
  const validTriggers = [
    'build_failure', 'drift', 'policy_violation', 'replay_mismatch',
    'test_failure', 'schema_gap', 'skill_gap', 'rollback_event',
    'cost_spike', 'fairness_violation'
  ];
  if (skill.triggers) {
    for (const trigger of skill.triggers) {
      if (!validTriggers.includes(trigger)) {
        errors.push(`${filePath}: Invalid trigger: ${trigger}`);
      }
    }
  }
  
  // Valid version format
  if (skill.version && !/^\d+\.\d+\.\d+$/.test(skill.version)) {
    errors.push(`${filePath}: Invalid version format: ${skill.version}`);
  }
  
  return errors;
}

function findSkillFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSkillFiles(fullPath));
    } else if (entry.name.endsWith('.json') && entry.name !== 'registry.json') {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function main() {
  console.log('Verifying skills...');
  
  const errors = [];
  const seenIds = new Set();
  
  // Find all skill files
  const skillFiles = findSkillFiles(SKILLS_DIR);
  
  if (skillFiles.length === 0) {
    console.log('No skill files found');
    process.exit(0);
  }
  
  // Validate each skill
  for (const file of skillFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const skill = JSON.parse(content);
      
      // Validate fields
      errors.push(...validateSkill(skill, file));
      
      // Check for duplicate IDs
      if (skill.id) {
        if (seenIds.has(skill.id)) {
          errors.push(`${file}: Duplicate skill ID: ${skill.id}`);
        }
        seenIds.add(skill.id);
      }
    } catch (err) {
      errors.push(`${file}: Failed to parse JSON - ${err}`);
    }
  }
  
  // Check registry exists
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.warn(`Warning: Registry file not found at ${REGISTRY_FILE}`);
  }
  
  // Report results
  if (errors.length > 0) {
    console.error('\n❌ Skill validation failed:');
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }
  
  console.log(`\n✅ Verified ${skillFiles.length} skill(s)`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
