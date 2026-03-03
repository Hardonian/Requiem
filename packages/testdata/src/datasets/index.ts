/**
 * Test Data Foundry - All Datasets
 * Register all available datasets here.
 */

import { registerDataset } from '../registry.js';

// Import all datasets
import { dataset as polTenantIsolation } from './pol_tenant_isolation.js';
import { dataset as polRoleEscalation } from './pol_role_escalation.js';
import { dataset as toolSchemaStress } from './tool_schema_stress.js';
import { dataset as advInjectBasic } from './adv_inject_basic.js';
import { dataset as advPathTraversal } from './adv_path_traversal.js';
import { dataset as repoDagCircular } from './repo_dag_circular.js';
import { dataset as cliPipePressure } from './cli_pipe_pressure.js';
import { dataset as perfColdStart } from './perf_cold_start.js';
import { dataset as faultOomScenario } from './fault_oom_scenario.js';
import { dataset as traceRoundtrip } from './trace_roundtrip.js';

/**
 * Register all datasets with the registry.
 */
export function registerAllDatasets(): void {
  registerDataset(polTenantIsolation);
  registerDataset(polRoleEscalation);
  registerDataset(toolSchemaStress);
  registerDataset(advInjectBasic);
  registerDataset(advPathTraversal);
  registerDataset(repoDagCircular);
  registerDataset(cliPipePressure);
  registerDataset(perfColdStart);
  registerDataset(faultOomScenario);
  registerDataset(traceRoundtrip);
}

// Export all datasets
export {
  polTenantIsolation,
  polRoleEscalation,
  toolSchemaStress,
  advInjectBasic,
  advPathTraversal,
  repoDagCircular,
  cliPipePressure,
  perfColdStart,
  faultOomScenario,
  traceRoundtrip,
};
