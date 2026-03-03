# Privacy Policy (Draft): Requiem

**Version**: 0.1.0-DRAFT  
**Last Updated**: 2026-03-02

## 1. Introduction

Requiem ("we", "us", or "our") is committed to protecting your privacy. This policy describes how we handle data within the Requiem Provable AI Runtime and the ReadyLayer control plane.

## 2. Data Collection & Use

### Reach CLI (Local Mode)

When using the Reach CLI locally, Requiem does not collect your prompts, tool outputs, or sensitive data. All cryptographic fingerprints are generated and stored on your local machine.

### ReadyLayer (Cloud Mode)

If you opt-in to use the ReadyLayer control plane, we collect:

- **Metadata**: Run IDs, timestamps, and policy hashes.
- **Diagnostics**: Error logs and engine version information to improve performance.
- **Identity**: User information provided during SSO (Single Sign-On).

## 3. Data Sovereignty & Isolation

- **Tenant Isolation**: Each customer's data is cryptographically isolated using domain-separated BLAKE3 keys.
- **No Model Training**: Requiem does not use your execution artifacts (prompts or responses) to train any models.
- **Retention**: Data retention is controlled by your subscription tier. Enterprise customers can define custom retention and deletion policies.

## 4. Third-Party Services

Requiem interacts with model providers (e.g., OpenAI, Anthropic) on your behalf. These providers have their own privacy policies. Requiem does not share your data with these providers beyond what is necessary to execute your specific requests.

## 5. Security Measures

We implement multi-layered security, including AES-256 encryption at rest and TLS 1.3 in transit. Our architecture is designed to prevent unauthorized access to your execution receipts.

## 6. Contact Us

For privacy-related inquiries, please contact <privacy@requiem.sh>.

---

**DISCLAIMER**: THIS DOCUMENT IS A DRAFT AND HAS NOT BEEN REVIEWED BY LEGAL COUNSEL.
