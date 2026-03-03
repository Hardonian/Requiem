# Finance & Operations: Requiem Billing Model

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. The "Metered Trust" Principle

Requiem bills based on the volume of **Verified Transformations**. We don't just bill for "uptime" but for the cryptographic verification of integrity.

## 2. Billing Dimensions

| Dimension | Description | Billing Basis |
| :--- | :--- | :--- |
| **Integrity Checks** | Running `reach verify` or automated platform checks. | Per 1,000 Checks |
| **Policy Events** | Each time a tool call hits the Policy VM gate. | Per 10,000 Events |
| **Storage (CAS)** | Persistent storage of BLAKE3-indexed artifacts. | Per GB / Month |
| **Management Nodes** | Dedicated ReadyLayer control plane instances. | Flat Monthly Fee |

## 3. Revenue Recognition

Revenue is recognized monthly based on the consumption of "Proof Credits." Credits are prepaid in bundles or billed in arrears for Enterprise customers with MSA (Master Service Agreements).

## 4. Expense Policy (Internal)

- **Compute**: Managed via AWS Spot Instances where possible to lower verification overhead.
- **Model Costs**: All R&D token usage is tracked via the `internal-research` tenant in ReadyLayer to provide visibility into "In-house entropy."

## 5. Key Financial KPIs

- **Gross Margin per Proof**: Revenue minus (Cloud compute + Hashing energy).
- **CAC Recovery Time**: Targeted < 6 months for Enterprise.
- **Net Revenue Retention (NRR)**: Tracking "Proof Expansion" as customers move more agents onto the Requiem runtime.

## 6. Accounts Receivable (AR) Flow

1. **Credit Low**: Automated alert at 20% remaining balance.
2. **Exhausted**: System moves to "Community Tier" (Local-only, no cloud verification) unless "Auto-Top-up" is enabled.
3. **Enterprise**: Net-30 payment terms via invoice.
