#!/usr/bin/env node
/**
 * verify:schemas
 * 
 * Validates JSON schemas in artifacts/schemas/
 */

import fs from 'fs';
import path from 'path';

const SCHEMAS_DIR = 'artifacts/schemas';

function validateSchema(schema, filePath) {
  const errors = [];
  
  // Check for required fields
  if (!schema.$schema) errors.push(`${filePath}: Missing $schema`);
  if (!schema.$id) errors.push(`${filePath}: Missing $id`);
  if (!schema.title) errors.push(`${filePath}: Missing title`);
  if (!schema.type) errors.push(`${filePath}: Missing type`);
  
  // Check type is valid
  if (schema.type && !['object', 'array', 'string', 'number', 'boolean', 'null'].includes(schema.type)) {
    errors.push(`${filePath}: Invalid type: ${schema.type}`);
  }
  
  // If type is object, check for properties
  if (schema.type === 'object' && !schema.properties) {
    errors.push(`${filePath}: Object type must have properties`);
  }
  
  return errors;
}

function findSchemaFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSchemaFiles(fullPath));
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function main() {
  console.log('Verifying schemas...');
  
  const errors = [];
  
  // Find all schema files
  const schemaFiles = findSchemaFiles(SCHEMAS_DIR);
  
  if (schemaFiles.length === 0) {
    console.log('No schema files found');
    process.exit(0);
  }
  
  // Validate each schema
  for (const file of schemaFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const schema = JSON.parse(content);
      
      errors.push(...validateSchema(schema, file));
    } catch (err) {
      errors.push(`${file}: Failed to parse JSON - ${err}`);
    }
  }
  
  // Report results
  if (errors.length > 0) {
    console.error('\n❌ Schema validation failed:');
    for (const error of errors) {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }
  
  console.log(`\n✅ Verified ${schemaFiles.length} schema(s)`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
