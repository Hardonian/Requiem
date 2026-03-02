# Entitlements System

Feature gating and quota management integrated through the Policy Engine.

## Overview

The entitlements system provides:

- **Tier-based features**: OSS, Pro, Enterprise tiers
- **Enforceable gates**: Cannot be bypassed
- **Quota management**: Usage limits per tier
- **Policy integration**: Single choke point for enforcement

## Tiers

### OSS (Default)

```toml
[entitlements]
tier = "oss"
```

Features:
- Basic execution and verification
- Local SQLite storage
- Single-region

Limits:
- 1,000 runs/month
- 10,000 decisions/month
- 100MB storage
- 10MB max export size

### Pro

```toml
[entitlements]
tier = "pro"
```

Features:
- Replication enabled
- Auto arbitration mode
- Required signing
- Multi-region support
- Advanced analytics

Limits:
- 10,000 runs/month
- 100,000 decisions/month
- 1GB storage
- 100MB max export size

### Enterprise

```toml
[entitlements]
tier = "enterprise"
```

Features:
- All Pro features
- Priority support
- Custom retention policies

Limits:
- 1,000,000 runs/month
- 10,000,000 decisions/month
- 100GB storage
- 1GB max export size

## Configuration

Add to `~/.requiem/config.toml`:

```toml
[entitlements]
tier = "pro"

# Override specific features
replication = true
arbitration_auto_mode = true
signing_required = true
```

Or use environment variables:

```bash
export REQUIEM_TIER=pro
export REQUIEM_REPLICATION=true
```

## CLI Commands

### Show entitlements

```bash
reach entitlement show
```

Output:
```
╔══════════════════════════════════════════════════════════╗
║              ENTITLEMENTS                                ║
╠══════════════════════════════════════════════════════════╣
║  Tier:   pro                                             ║
║  Source: config                                          ║
╠══════════════════════════════════════════════════════════╣
║  FEATURES                                                ║
╠══════════════════════════════════════════════════════════╣
║  Replication         ✓ ENABLED                           ║
║  Auto Arbitration    ✓ ENABLED                           ║
║  Signing Required    ✓ ENABLED                           ║
║  Multi-Region        ✓ ENABLED                           ║
...
```

### Verify gates

```bash
reach entitlement verify
```

Checks all policy gates and reports status.

## Policy Integration

The entitlements system integrates with the Policy Engine:

```typescript
import { policyGate } from '../lib/entitlements.js';

// In a command handler
const check = policyGate('replication');
if (!check.allowed) {
  throw new Error(`Replication not allowed: ${check.reason}`);
}

// With parameters
const exportCheck = policyGate('export', { exportSizeBytes: fileSize });
if (!exportCheck.allowed) {
  throw new Error(exportCheck.reason);
}
```

## Feature Gates

| Feature | OSS | Pro | Enterprise |
|---------|-----|-----|------------|
| `replication` | ✗ | ✓ | ✓ |
| `arbitrationAutoMode` | ✗ | ✓ | ✓ |
| `signingRequired` | ✗ | ✓ | ✓ |
| `multiRegion` | ✗ | ✓ | ✓ |
| `advancedAnalytics` | ✗ | ✓ | ✓ |
| `prioritySupport` | ✗ | ✗ | ✓ |

## Error Codes

| Code | Description |
|------|-------------|
| `E_FEATURE_NOT_ENABLED` | Feature requires tier upgrade |
| `E_QUOTA_EXCEEDED` | Monthly quota exceeded |
| `E_EXPORT_TOO_LARGE` | Export size exceeds tier limit |

## Testing

Test with different tiers:

```bash
# Test OSS (default)
REQUIEM_TIER=oss reach entitlement show

# Test Pro
REQUIEM_TIER=pro reach entitlement show

# Test Enterprise
REQUIEM_TIER=enterprise reach entitlement show
```
