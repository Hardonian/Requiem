# ENTROPY REMOVAL LOG

Removed duplicate helper behavior and centralized into truth spine:

- Removed local canonicalize+sha256 implementations in `ready-layer/src/lib/big4-audit.ts`.
- Removed duplicated Problem+JSON payload construction in `ready-layer/src/lib/problem-json.ts`.
- Added a single reusable runtime truth module in `packages/core/src/truth-spine.ts`.
