# Workflow Guide

Workflows are stored in `/workflows/*.json`.

Each workflow definition includes:

- `metadata`
- `inputs_schema`
- `execution_graph`
- `policy_hooks`
- `expected_outputs`

## Commands

- `requiem workflow:list`
- `requiem workflow:inspect <workflow>`
- `requiem workflow:run <workflow> --input='{...}'`

## Node Types

- `task`: deterministic local transform
- `adapter`: deterministic adapter invocation
- `subworkflow`: nested workflow call preserving graph order

## Real Workload Templates

- `api_data_pipeline`
- `llm_agent_orchestration`
- `file_ingestion_pipeline`
- `policy_validation`

These templates are replay-safe and emit proofpacks.
