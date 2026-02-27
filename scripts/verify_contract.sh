#!/usr/bin/env bash
set -euo pipefail
./build/requiem exec run --request docs/examples/exec_request.json --out build/example_result.json
./build/requiem digest verify --result build/example_result.json
