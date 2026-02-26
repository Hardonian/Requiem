#!/usr/bin/env bash
set -euo pipefail
./build/requiem_cli exec run --request docs/examples/exec_request.json --out build/example_result.json
./build/requiem_cli digest verify --result build/example_result.json
