# Golden Corpus — Requiem Determinism Gate

This directory contains the canonical golden fixture set for the Requiem
determinism and regression test suite. **Do not edit fixtures manually.**
Regenerate with:

```
scripts/generate_golden_corpus.sh
```

## Categories

| File Pattern | Category | Purpose |
|---|---|---|
| `small_*.request.json` | small | Fast single-command workload; used in the 200x determinism loop |
| `medium_*.request.json` | medium | Multi-step pipeline; validates env isolation |
| `large_*.request.json` | large | Stress output sizing and CAS storage paths |
| `corruption_*.request.json` | corruption tail | Invalid inputs asserting correct error codes (not determinism) |
| `*.expected_digest` | expected digests | Committed expected `result_digest` values for regression |

## Invariants

1. Every `*.request.json` in `small_` and `medium_` categories **must** produce
   identical `result_digest` across 200 sequential runs.
2. Every `*.expected_digest` file must match the live binary output on CI.
3. Any change to serialization rules or hash algorithm **requires** regenerating
   all fixtures and committing new `*.expected_digest` files.
4. Corruption fixtures must produce a non-ok result (exit_code != 0 **or**
   `ok: false`) — they are NOT expected to be deterministic in digest.

## CI Gate

`scripts/verify_determinism.sh` runs the full suite and emits
`artifacts/determinism_report.json` which is uploaded as a CI artifact.
