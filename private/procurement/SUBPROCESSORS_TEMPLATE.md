# Sub-Processors: Requiem / Zeo

## 📄 Sub-Processor List

Zeo (the "Company") uses certain core sub-processors to assist in delivering the **Requiem** Provable AI Runtime.

| Entity | Service Description | Category | Location |
| :--- | :--- | :--- | :--- |
| **Amazon Web Services (AWS)** | Cloud Infrastructure, S3-Compatible CAS Hosting. | Infrastructure | US/EU/ASIA |
| **Google Cloud Platform (GCP)** | Analysis, Monitoring, and Dashboard Hosting. | Infrastructure | Global |
| **Stripe, Inc.** | Payment processing and execution credit management. | FinOps | US |
| **Auth0 / Okta** | Identity verification and tenant isolation gates. | AuthN/AuthZ | US |

## Infrastructure Selection

Enterprise customers can choose to host the **Native Engine** and/or the **CAS (Content-Addressable Storage)** on their own VPC or dedicated infrastructure to bypass third-party sub-processors for specific execution workloads.

## Verification of Sub-Processor Boundaries

- All sub-processors are required to provide **SOC 2 Type II** or equivalent audit reports to the Company annually.
- Data sent to sub-processors is encrypted in transit and at rest using **AES-256** or current security standards.
- Tenant data is cryptographically isolated using **mTLS-v1** gates before any external data transfer occurs.
