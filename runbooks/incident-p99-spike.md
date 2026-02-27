# Runbook: P99 Latency Spike

**Severity:** P2
**Trigger:** p99 execution latency > 5000ms (policy `p99_spike_threshold_ms`)
**Auto-capture:** Yes

## What This Means

Tail latency has spiked beyond acceptable bounds. Execution correctness is likely
unaffected but user experience is degraded.

## Immediate Actions

1. **Capture metrics snapshot:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" /api/engine/metrics
   ```

2. **Check autotune state:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" /api/engine/autotune
   ```

3. **Run diagnostics:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" /api/engine/diagnostics
   ```

## Common Causes

| Symptom | Cause | Action |
|---------|-------|--------|
| All tenants affected | Engine-level bottleneck | Check CAS I/O, sandbox spawn rate |
| One tenant affected | Quota/rate-limit interaction | Review tenant quota config |
| After deployment | Regression | Roll back, run verify_bench.sh |
| Correlated with CAS ops | CAS latency spike | Check storage backend |

## Recovery

1. Check if autotune needs to revert to baseline parameters.
2. Scale workers if overloaded.
3. Review `./scripts/verify_bench.sh` for regression.

## Post-Incident

1. Update p99 threshold in policy if baseline has legitimately shifted.
2. Add benchmark assertion for the discovered latency path.
