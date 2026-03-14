# Developer Guide

## Quickstart

1. Scaffold a project:
   ```bash
   requiem new my-project
   ```
2. List built-in workflows:
   ```bash
   requiem workflow:list
   ```
3. Run a workflow and generate proof artifacts:
   ```bash
   requiem workflow:run file_pipeline --input='{"left":"a","right":"b"}'
   ```
4. Inspect a run:
   ```bash
   requiem debug <execution_id>
   ```

## Local Sandbox

Start local sandbox services with deterministic defaults:

```bash
requiem sandbox
```

This initializes local engine, CAS, and policy state under `.requiem/`.

## Determinism and Replay

Every workflow run emits:

- replay log: `proofpacks/workflows/<run>.replay.json`
- proofpack: `proofpacks/workflows/<run>.proofpack.json`
- CAS object: `.requiem/cas/objects/*`

Use these artifacts for replay verification and audit review.
