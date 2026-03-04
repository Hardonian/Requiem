# RUNTIME FINGERPRINT

Implemented command:

- `rl system fingerprint`

The command emits and persists a runtime fingerprint artifact with:

- `git_commit`
- `invariants_spec_version`
- `policy_bundle_cas`
- `config_cas`
- `replica_mode`
- `capabilities_mode`
- `intents_mode`
- `determinism_mode`

CAS persistence:

- Object path: `<casDir>/objects/<first2>/<digest>`
- Metadata path: `<object>.meta`
- Latest reference: `<casDir>/refs/runtime-fingerprint.latest.json`

`proof` producers can reference the latest fingerprint CAS digest via the ref file and include it in proof metadata.
