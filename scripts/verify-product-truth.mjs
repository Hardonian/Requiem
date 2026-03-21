#!/usr/bin/env node

/**
 * Verify product truth gates.
 *
 * Ensures the repo does not regress into ambiguity about:
 * - execution durability claims
 * - membership lifecycle claims
 * - readiness contract fields
 * - deployment topology documentation
 */

import { existsSync, readFileSync } from 'node:fs';

let failures = 0;

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fileContains(filePath, needle, description) {
  if (!existsSync(filePath)) {
    fail(`${description} — file not found: ${filePath}`);
    return;
  }
  const content = readFileSync(filePath, 'utf8');
  if (content.includes(needle)) {
    pass(description);
  } else {
    fail(`${description} — expected to find "${needle}" in ${filePath}`);
  }
}

function fileDoesNotContain(filePath, needle, description) {
  if (!existsSync(filePath)) {
    pass(`${description} — file not found (acceptable)`);
    return;
  }
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes(needle)) {
    pass(description);
  } else {
    fail(`${description} — found "${needle}" in ${filePath} which should not be there`);
  }
}

console.log('=== Product Truth Verification ===\n');

// 1. Readiness must NOT claim background_execution_supported
fileDoesNotContain(
  'ready-layer/src/lib/readiness.ts',
  'background_execution_supported',
  'Readiness does not overclaim background_execution_supported',
);

// 2. Readiness must report autonomous_worker_active: false
fileContains(
  'ready-layer/src/lib/readiness.ts',
  'autonomous_worker_active',
  'Readiness reports autonomous_worker_active field',
);

// 3. Readiness must report durable_queue_available
fileContains(
  'ready-layer/src/lib/readiness.ts',
  'durable_queue_available',
  'Readiness reports durable_queue_available field',
);

// 4. Deployment contract exports execution taxonomy
fileContains(
  'ready-layer/src/lib/deployment-contract.ts',
  'EXECUTION_TAXONOMY',
  'Deployment contract exports EXECUTION_TAXONOMY',
);

// 5. Deployment contract exports membership lifecycle truth
fileContains(
  'ready-layer/src/lib/deployment-contract.ts',
  'MEMBERSHIP_LIFECYCLE',
  'Deployment contract exports MEMBERSHIP_LIFECYCLE',
);

// 6. Deployment contract lists not_implemented membership items
fileContains(
  'ready-layer/src/lib/deployment-contract.ts',
  'email-based invite with durable token',
  'Membership lifecycle explicitly marks invite as not implemented',
);

// 7. README does not claim durable background workers are proven
fileDoesNotContain(
  'README.md',
  'proves durable background workers',
  'README does not claim durable background workers are proven',
);

// 8. PRODUCT_BOUNDARIES.md exists
fileContains(
  'docs/PRODUCT_BOUNDARIES.md',
  'no autonomous background worker',
  'PRODUCT_BOUNDARIES.md states no autonomous background worker',
);

// 9. DEPLOYMENT.md mentions the durable queue truth
fileContains(
  'docs/DEPLOYMENT.md',
  'no autonomous background worker',
  'DEPLOYMENT.md states no autonomous background worker',
);

// 10. Job route includes execution_class metadata
fileContains(
  'ready-layer/src/app/api/tenants/jobs/route.ts',
  'execution_class',
  'Job API route includes execution_class metadata',
);

// 11. No invite API endpoint exists
fileDoesNotContain(
  'ready-layer/src/app/api/tenants/organizations/route.ts',
  "'invite'",
  'Organization route does not support invite action',
);

// 12. Readiness includes membership_lifecycle in deployment_contract
fileContains(
  'ready-layer/src/lib/readiness.ts',
  'membership_lifecycle',
  'Readiness includes membership_lifecycle in deployment_contract',
);

console.log(`\n=== ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} ===`);
if (failures > 0) {
  process.exit(1);
}
