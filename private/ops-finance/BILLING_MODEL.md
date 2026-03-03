# Finance & Operations: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Billing Model (Metered Trust)
Requiem uses a **Consumption-Based Billing** model integrated with the runtime.

### Metered Units
- **The Fingerprint**: Cryptographic hashing of a tool call or state transition ($0.0X).
- **The Audit (Verify)**: Cryptographic verification of a historical receipt ($0.0Y).
- **The Policy Eval**: Execution within the Policy VM gate ($0.0Z).
- **Long-term Storage**: CAS volume residency (GB/Month).

## 2. Cost Tracking System
The `reach usage` command provides real-time cost attribution.
- **Tenant ID**: Costs are split by customer/department.
- **Project ID**: Costs are attributed to specific AI initiatives.
- **Budget Enforced**: In the Policy VM, an agent can be blocked *mid-execution* if it exceeds its daily credit limit.

## 3. Revenue Recognition
- **Subscriptions (Pro)**: Recognized monthly on a straight-line basis.
- **Consumption Credits**: Recognized at the moment of the cryptographic proof generation (The "Receipt").
- **Enterprise Contracts**: Recognized based on service delivery milestones and annual duration.

## 4. Expense Policy (The "Lean Ops" Approach)
- **Infrastructure**: Budgeted at < 15% of Gross Revenue.
- **AI Tooling**: All internal AI tools must be governed by a Requiem Policy Gate (We "Eat our own Dogfood").
- **Travel**: Focused on high-impact Enterprise sales and major AI safety conferences.

## 5. KPI Dashboard (The "Operational Scorecard")
| Metric | Healthy Range | Current (Est.) |
|--------|---------------|----------------|
| **Gross Margin** | > 85% | 96% |
| **CAC Payback** | < 12 Months| 9 Months |
| **Net Revenue Retention**| > 110% | N/A (Beta) |
| **Trust Score** | 100% | 100% (CI) |

## 6. Financial Controls
- **Dual-Approval**: All expenses over $5k require VP and Finance approval.
- **Ledger Integrity**: Our internal financial ledger is mirrored to a private Requiem CAS instance to prevent accounting "drift."
