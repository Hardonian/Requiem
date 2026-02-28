# Cost Anomaly Strategy — Requiem AI Infrastructure

This document outlines the architecture and detection formulas for identifying and mitigating cost anomalies in the AI execution layer.

## 1. Detection Metrics

To prevent "budget storms" and "token explosions," the following metrics must be tracked per tenant:

*   **Token Velocity (TV)**: Rate of token consumption per minute.
*   **Tool Loop Density (TLD)**: Ratio of tool calls to autonomous reasoning steps.
*   **Sequential Fallback Count (SFC)**: Number of consecutive model fallbacks triggered by errors or timeouts.

## 2. Detection Formulas

### Token Spike Detection
A spike is defined as a deviation from the moving average consumption:

$$ TV > \mu(TV_{last\_24h}) + 3\sigma(TV_{last\_24h}) $$

### Loop Detection (Recursive Explosion)
Detects agents stuck in a state-change loop without progress:

$$ \frac{\text{Unique State Hashes}}{\text{Total Tool Calls}} < 0.1 \text{ (over 10 calls)} $$

## 3. Threshold Matrix

| Severity | Threshold Type | Limit | Action |
| --- | --- | --- | --- |
| YELLOW | Request Burst | > 50 req/min | Log + Warn |
| ORANGE | Token Overage | > 150% budget | Throttle |
| RED | Loop / Explosion | > 50 recursive calls | Kill Process |

## 4. Mitigation Architecture

### Circuit Breakers
Implemented at the `AgentRunner` layer to stop execution if:
1.  Budget per requestId exceeded.
2.  Total tenant daily cap reached.
3.  Anomalous pattern detected (Pattern-based).

### Tiered Throttling
1.  **soft_limit**: Inject latency into tool responses.
2.  **hard_limit**: Return `E_BUDGET_EXHAUSTED` for all new requests.

---
**Status**: DESIGN - To be implemented in Phase 5.
