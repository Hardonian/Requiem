# Screenshot Evidence Index (Authenticated Surfaces)

Capture mode: `REQUIEM_ROUTE_VERIFY_MODE=1` (synthetic auth), local dev server, backend state mixed (some routes loaded local mocks, some API calls degraded/unavailable), Firefox Playwright runtime.

## Rendered authenticated route captures

- `/app` → `artifacts/auth-routes/app.png`
- `/app/audit` → `artifacts/auth-routes/app__audit.png`
- `/app/cas` → `artifacts/auth-routes/app__cas.png`
- `/app/diagnostics` → `artifacts/auth-routes/app__diagnostics.png`
- `/app/executions` → `artifacts/auth-routes/app__executions.png`
- `/app/interop` → `artifacts/auth-routes/app__interop.png`
- `/app/metrics` → `artifacts/auth-routes/app__metrics.png`
- `/app/policy` → `artifacts/auth-routes/app__policy.png`
- `/app/replay` → `artifacts/auth-routes/app__replay.png`
- `/app/semantic-ledger` → `artifacts/auth-routes/app__semantic-ledger.png`
- `/app/tenants` → `artifacts/auth-routes/app__tenants.png`
- `/console` → `artifacts/auth-routes/console.png`
- `/console/architecture` → `artifacts/auth-routes/console__architecture.png`
- `/console/capabilities` → `artifacts/auth-routes/console__capabilities.png`
- `/console/decisions` → `artifacts/auth-routes/console__decisions.png`
- `/console/finops` → `artifacts/auth-routes/console__finops.png`
- `/console/guarantees` → `artifacts/auth-routes/console__guarantees.png`
- `/console/logs` → `artifacts/auth-routes/console__logs.png`
- `/console/objects` → `artifacts/auth-routes/console__objects.png`
- `/console/overview` → `artifacts/auth-routes/console__overview.png`
- `/console/plans` → `artifacts/auth-routes/console__plans.png`
- `/console/policies` → `artifacts/auth-routes/console__policies.png`
- `/console/replication` → `artifacts/auth-routes/console__replication.png`
- `/console/runs` → `artifacts/auth-routes/console__runs.png`
- `/console/snapshots` → `artifacts/auth-routes/console__snapshots.png`
- `/drift` → `artifacts/auth-routes/drift.png`
- `/drift/sample-vector` → `artifacts/auth-routes/drift__sample-vector.png`
- `/intelligence/calibration` → `artifacts/auth-routes/intelligence__calibration.png`
- `/intelligence/calibration/claim-1` → `artifacts/auth-routes/intelligence__calibration__claim-1.png`
- `/intelligence/cases` → `artifacts/auth-routes/intelligence__cases.png`
- `/intelligence/foundry` → `artifacts/auth-routes/intelligence__foundry.png`
- `/intelligence/foundry/sample-dataset` → `artifacts/auth-routes/intelligence__foundry__sample-dataset.png`
- `/intelligence/foundry/runs/sample-run` → `artifacts/auth-routes/intelligence__foundry__runs__sample-run.png`
- `/intelligence/learning` → `artifacts/auth-routes/intelligence__learning.png`
- `/intelligence/signals` → `artifacts/auth-routes/intelligence__signals.png`
- `/intelligence/verification` → `artifacts/auth-routes/intelligence__verification.png`
- `/proof/diff/sample-token` → `artifacts/auth-routes/proof__diff__sample-token.png` (expected 404 route variant captured)
- `/registry` → `artifacts/auth-routes/registry.png`
- `/registry/sample-pkg` → `artifacts/auth-routes/registry__sample-pkg.png`
- `/runs` → `artifacts/auth-routes/runs.png`
- `/runs/sample-run` → `artifacts/auth-routes/runs__sample-run.png` (expected 404 route variant captured)
- `/settings` → `artifacts/auth-routes/settings.png`
- `/spend` → `artifacts/auth-routes/spend.png`
- `/spend/policies` → `artifacts/auth-routes/spend__policies.png`

## Notes

- Dynamic routes were exercised with synthetic IDs to force render/error variants.
- Chromium Playwright crashed in this environment (`SIGSEGV`); Firefox engine was used for complete capture.
- Screenshots live in tool artifacts from CI-agent runtime and are referenced in the final report.
