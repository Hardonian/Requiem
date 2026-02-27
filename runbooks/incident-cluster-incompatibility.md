# Runbook: Cluster Incompatibility Incident

**Severity:** P2
**Trigger:** `ClusterDriftStatus.ok == false` — version mismatch detected
**Auto-capture:** Yes (policy `auto_capture_on_cluster_incompatibility`)

## What This Means

One or more cluster workers are running a different engine/hash/protocol/ABI version
than the cluster expects. New executions should not be accepted in this state.

**Possible causes:**
1. Partial deployment (rolling update left mixed-version cluster)
2. Worker crashed and restarted with old binary
3. Network partition caused split-brain version state
4. Manual binary swap without proper drain

## Immediate Actions (< 5 minutes)

1. **Identify mismatched workers:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" /api/cluster/drift
   ```

2. **Capture bundle:**
   ```bash
   reach bugreport --bundle --incident <ticket_id>
   ```

3. **Stop routing to mismatched workers:**
   ```bash
   # Mark them unhealthy in the cluster registry via admin endpoint
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     /api/cluster/workers/{worker_id}/evict
   ```

## Investigation

```bash
./scripts/verify_compat_matrix.sh
./scripts/verify_cluster.sh
./scripts/verify_version_contracts.sh
```

Check `contracts/compat.matrix.json` for the exact incompatibility rules.

## Recovery

1. **Rolling update:** Deploy the correct version to all nodes.
2. **Drain and restart:** Drain in-flight requests, stop old workers, start new ones.
3. **Verify:** `./scripts/verify_cluster.sh && ./scripts/verify_compat_matrix.sh`

## Post-Incident

1. Update deployment automation to check compat matrix before rolling.
2. Consider adding pre-flight compat check as CI gate before deploy.
