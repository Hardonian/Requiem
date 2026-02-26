#!/usr/bin/env bash
set -euo pipefail
./build/requiem_cli cas gc --cas .requiem/cas --json
./build/requiem_cli exec run --request docs/examples/exec_request_smoke.json --out build/smoke_result.json
./build/requiem_cli exec replay --request docs/examples/exec_request_smoke.json --result build/smoke_result.json --cas .requiem/cas
