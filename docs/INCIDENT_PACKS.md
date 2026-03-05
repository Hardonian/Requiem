# Incident Packs (`.rqpack`)

Portable format: `rqpack/v1` JSON.

Includes:

- tool events
- diagnosis summary
- repair plan
- env + policy fingerprints
- artifact CAS refs
- redacted args
- optional mocks
- deterministic proof fingerprint

Commands:

- `rq incident export <run_id> --out run.rqpack`
- `rq incident import run.rqpack`
- `rq incident replay run.rqpack --mock`

Replay validates classification and diagnosis stability under isolated mock mode.
