# Service Level Agreement (SLA) Template: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Service Commitment

Requiem will provide the Cloud Control Plane (ReadyLayer) with a Monthly Uptime Percentage of at least **99.9%**.

## 2. Definitions

- **"Down"**: When the ReadyLayer API returns 5xx errors or the CAS is inaccessible for more than 5 consecutive minutes.
- **"Degraded"**: When p99 latency for policy evaluation exceeds 500ms for more than 15 minutes.

## 3. Support Response Times

| Severity | Description | Response Time | Target Resolution |
| :--- | :--- | :--- | :--- |
| **P0** | Global outage, data loss risk. | 1 Hour | 4 Hours |
| **P1** | Major degradation, single tenant down. | 4 Hours | 12 Hours |
| **P2** | Minor bugs, feature requests. | 1 Business Day | Next Sprint |
| **P3** | General questions, documentation. | 2 Business Days | Best Effort |

## 4. Service Credits

If we fail to meet the 99.9% uptime commitment, customers are eligible for Service Credits against their monthly bill:

| Monthly Uptime % | Service Credit % |
| :--- | :--- |
| < 99.9% | 10% |
| < 99.0% | 25% |
| < 95.0% | 50% |

## 5. Exclusions

This SLA does not apply to:

- Scheduled maintenance windows (notified 48h in advance).
- Failures caused by underlying model providers (e.g., OpenAI outage).
- Alpha or Beta features tagged as "Experimental."
