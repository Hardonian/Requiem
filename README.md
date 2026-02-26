# Requiem (rqr) — Deterministic Native Runtime

Requiem is a native C++ runtime for deterministic command execution, content-addressable storage, replay validation, and benchmark harnessing.

## Build
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

## Verify scripts
```bash
./scripts/verify.sh
./scripts/verify_contract.sh
./scripts/verify_smoke.sh
./scripts/verify_lint.sh
```

## CLI
- `requiem_cli exec run --request <json> --out <json>`
- `requiem_cli exec replay --request <json> --result <json> --cas <dir>`
- `requiem_cli digest verify --result <json>`
- `requiem_cli cas gc --cas <dir> [--json]`
- `requiem_cli trace pretty --result <json>`
- `requiem_cli policy explain`
- `requiem_cli bench run --spec <json> --out <json>`
