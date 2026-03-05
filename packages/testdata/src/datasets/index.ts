import { registerDataset } from '../registry.js';
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
import { dataset as repoLineageDataset } from './repo_lineage_dataset.js';
import { dataset as pipelineExecutionDataset } from './pipeline_execution_dataset.js';
import { dataset as artifactMutationDataset } from './artifact_mutation_dataset.js';
import { dataset as driftDetectionDataset } from './drift_detection_dataset.js';

export const BUILTIN_DATASETS = [
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
  repoLineageDataset,
  pipelineExecutionDataset,
  artifactMutationDataset,
  driftDetectionDataset,
] as const;

let registered = false;

export function registerBuiltInDatasets(): void {
  if (registered) {
    return;
  }
  for (const dataset of BUILTIN_DATASETS) {
    registerDataset(dataset);
  }
  registered = true;
}
