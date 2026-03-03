# Service Level Agreement (SLA): Requiem Enterprise

**Draft Version**: 0.9.0  
**Last Updated**: 2026-03-02

## 1. Service Commitment
Requiem will use commercially reasonable efforts to make the ReadyLayer Cloud Control Plane available with a Monthly Uptime Percentage of at least **99.9%**.

## 2. Definitions
- **Downtime**: When the Requiem API is unable to process policy evaluation requests or receive new execution receipts.
- **Service Credit**: A dollar credit, calculated as a percentage of the monthly bill, that Requiem may issue to an eligible account.

## 3. Service Credits

| Monthly Uptime Percentage | Service Credit Percentage |
|---------------------------|---------------------------|
| < 99.9% but >= 99.0% | 10% |
| < 99.0% but >= 95.0% | 25% |
| < 95.0% | 50% |

## 4. Support Response Times (Enterprise Only)

| Severity | Description | Initial Response |
|----------|-------------|------------------|
| **P0 - Critical** | System Down, total loss of service. | 1 Hour |
| **P1 - Major** | Core feature unavailable, no workaround. | 4 Hours |
| **P2 - Minor** | Partial degredation, workaround exists. | 8 Hours |
| **P3 - General** | Documentation, guidance, features. | 2 Business Days |

## 5. Exclusions
This SLA does not apply to:
- Performance of the underlying Model Providers (e.g., OpenAI, Anthropic outages).
- Issues caused by the customer's own network or "Reach" CLI local environment.
- Scheduled maintenance (notified at least 48 hours in advance).
