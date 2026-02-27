#!/usr/bin/env bash
set -euo pipefail
./build/requiem cas gc --cas .requiem/cas/v2
./build/requiem exec run --request docs/examples/exec_request_smoke.json --out build/smoke_result.json
./build/requiem exec replay --request docs/examples/exec_request_smoke.json --result build/smoke_result.json --cas .requiem/cas/v2
