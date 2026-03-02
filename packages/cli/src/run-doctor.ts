#!/usr/bin/env tsx
import { runDoctor } from './commands/doctor.js';

async function main() {
  // Execute the doctor check
  // This will verify Engine, Database, Schema, and the new Telemetry aggregation
  await runDoctor({ json: false });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

