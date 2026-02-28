# Skills

The Requiem Skills system provides a framework for creating versioned, auditable, and testable agent workflows. A Skill is a pre-defined sequence of steps that an AI agent can execute to accomplish a specific goal.

## Key Concepts

-   **Skill Definition**: A structured object that defines a skill's name, version, description, required tools, and the steps to execute.
-   **Skill Step**: A single action within a skill. It can be a call to a tool, a prompt to an LLM, or an assertion.
-   **Skill Registry**: A central place to register and retrieve skills.
-   **Skill Runner**: The engine that executes the steps of a skill in sequence, handling inputs, outputs, and errors.

## Defining a Skill

Skills are defined using the `SkillDefinition` interface and registered with the `registerSkill` function.

**Example Skill Definition:**
```typescript
import { registerSkill } from './registry';

registerSkill({
  name: 'root_cause_investigation',
  version: '1.0.0',
  description: 'Investigates a junction to identify the root cause.',
  requiredTools: ['datastore_junction_findById', 'datastore_decision_findById'],
  steps: [
    {
      kind: 'tool',
      toolName: 'datastore_junction_findById',
      input: { id: '{{initial.junctionId}}' },
    },
    {
      kind: 'tool',
      toolName: 'datastore_decision_findById',
      input: { id: '{{datastore_junction_findById.decision_report_id}}' },
    },
    {
        kind: 'llm',
        prompt: `
        Investigate the root cause of the following junction and decision.
        Junction: {{datastore_junction_findById}}
        Decision: {{datastore_decision_findById}}
        `,
    }
  ],
});
```

## Running a Skill

Skills are executed by the `runSkill` function, which takes an `InvocationContext` and the skill definition. The runner handles the execution of each step, passing the output of one step as input to subsequent steps.

## Baseline Skills

The following skills are available out-of-the-box:

-   `trace_summary`: Summarizes a canonical log trace.
-   `root_cause_investigation`: Investigates a junction to identify the root cause.
-   `policy_decision_explain`: Explains a policy decision.
