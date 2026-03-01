#!/usr/bin/env tsx
import { runDoctor } from './db/doctor';

async function main() {
  // Execute the doctor check
  // This will verify Engine, Database, Schema, and the new Telemetry aggregation
  await runDoctor({ json: false });
}

main();
