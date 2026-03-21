#!/usr/bin/env node

/**
 * Verify product truth gates.
 *
 * Ensures the repo does not regress into ambiguity about:
 * - execution durability claims
 * - membership lifecycle claims
 * - readiness contract fields
 * - deployment topology documentation
 * - autonomous worker infrastructure
 * - invite lifecycle infrastructure
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

// 1. Readiness must NOT claim background_execution_supported (old overclaim field)
fileDoesNotContain(
  'ready-layer/src/lib/readiness.ts',
  'background_execution_supported',
  'Readiness does not overclaim background_execution_supported',
);

// 2. Readiness must report autonomous_worker_active (dynamic field)
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

// 6. Membership lifecycle includes invite support
fileContains(
  'ready-layer/src/lib/deployment-contract.ts',
  'invite user by email with durable token and expiry',
  'Membership lifecycle includes invite support',
);

// 7. README does not claim durable background workers are proven
fileDoesNotContain(
  'README.md',
  'proves durable background workers',
  'README does not claim durable background workers are proven',
);

// 8. PRODUCT_BOUNDARIES.md exists and documents worker
fileContains(
  'docs/PRODUCT_BOUNDARIES.md',
  'autonomous worker',
  'PRODUCT_BOUNDARIES.md documents autonomous worker',
);

// 9. DEPLOYMENT.md documents worker capability
fileContains(
  'docs/DEPLOYMENT.md',
  'autonomous worker',
  'DEPLOYMENT.md documents autonomous worker',
);

// 10. Job route includes execution_class metadata
fileContains(
  'ready-layer/src/app/api/tenants/jobs/route.ts',
  'execution_class',
  'Job API route includes execution_class metadata',
);

// 11. Invite API endpoint exists
fileContains(
  'ready-layer/src/app/api/tenants/invites/route.ts',
  'invite',
  'Invite API route exists',
);

// 12. Worker API endpoint exists
fileContains(
  'ready-layer/src/app/api/worker/route.ts',
  'startWorkerLoop',
  'Worker API route uses real worker loop',
);

// 13. Worker registry provides dynamic state
fileContains(
  'ready-layer/src/lib/worker-registry.ts',
  'isAnyWorkerActive',
  'Worker registry exports isAnyWorkerActive',
);

// 14. Readiness includes membership_lifecycle in deployment_contract
fileContains(
  'ready-layer/src/lib/readiness.ts',
  'membership_lifecycle',
  'Readiness includes membership_lifecycle in deployment_contract',
);

// 15. Member management API exists
fileContains(
  'ready-layer/src/app/api/tenants/members/route.ts',
  'remove',
  'Member management API supports member removal',
);

console.log(`\n=== ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} ===`);
if (failures > 0) {
  process.exit(1);
}
