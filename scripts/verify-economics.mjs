#!/usr/bin/env node
/**
 * verify:economics
 * 
 * Validates economic model configuration
 */

import fs from 'fs';

const COST_MODEL_FILE = 'contracts/cost-model.json';

function validateCostModel(config, filePath) {
  const errors = [];
  
  // Check for required sections
  if (!config.version) errors.push(`${filePath}: Missing version`);
  if (!config.cost_units) errors.push(`${filePath}: Missing cost_units`);
  if (!config.thresholds) errors.push(`${filePath}: Missing thresholds`);
  
  // Validate cost_units
  if (config.cost_units) {
    const costUnits = config.cost_units;
    const requiredUnits = ['execution_unit', 'replay_storage_unit', 'policy_eval_unit', 'drift_analysis_unit'];
    for (const unit of requiredUnits) {
      if (typeof costUnits[unit] !== 'number') {
        errors.push(`${filePath}: Missing or invalid cost_units.${unit}`);
      }
    }
  }
  
  // Validate thresholds
  if (config.thresholds) {
    const thresholds = config.thresholds;
    if (typeof thresholds.burn_spike_multiplier !== 'number') {
      errors.push(`${filePath}: Missing thresholds.burn_spike_multiplier`);
    }
    if (typeof thresholds.fairness_violation_threshold !== 'number') {
      errors.push(`${filePath}: Missing thresholds.fairness_violation_threshold`);
    }
  }
  
  return errors;
}

async function main() {
  console.log('Verifying economics...');
  
  const errors = [];
  
  // Check cost model exists
  if (!fs.existsSync(COST_MODEL_FILE)) {
    console.error(`❌ Cost model file not found: ${COST_MODEL_FILE}`);
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(COST_MODEL_FILE, 'utf-8');
    const config = JSON.parse(content);
    
    errors.push(...validateCostModel(config, COST_MODEL_FILE));
  } catch (err) {
    errors.push(`${COST_MODEL_FILE}: Failed to parse JSON - ${err}`);
  }
  
  // Report results
  if (errors.length > 0) {
    console.error('\n❌ Economics validation failed:');
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }
  
  console.log('\n✅ Economics configuration valid');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
