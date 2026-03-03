# Support: Requiem / Zeo

## 🚨 Security Outages / Tenant Leakage

If you have discovered a security vulnerability or a potential for cross-tenant data leakage, please do **NOT** open a public issue. Follow the instructions in [SECURITY.md](SECURITY.md).

## 🛠️ Community Support (Open Source)

For help using the open-source version of Requiem, please use the following:

- **GitHub Issues**: Use [bug_report.yml](.github/ISSUE_TEMPLATE/bug_report.yml) or [feature_request.yml](.github/ISSUE_TEMPLATE/feature_request.yml).
- **GitHub Discussions**: General questions, implementation tips, and community-led support.

## 🏢 Enterprise Support (SLA-Backed)

If you are an Enterprise customer, please use your dedicated support channel or email:

- **Email**: <support@zeo.ai> [Placeholder - REPLACE WITH ACTUAL]
- **Tenant ID**: Please provide your tenant hash in all communications.
- **SLA**: Initial response for P0 (Critical) incidents within 4 hours.

## 📋 Triage Preparation

When filing an issue, please ensure you have the following ready:

1. **Execution Fingerprint** (64-character hash).
2. **Short ID** (8-character hash).
3. **Version** (`pnpm reach version`).
4. **Diagnostic Output** (`pnpm reach doctor --format=md`).

## Invariant Failure (Determinism Breach)

If you detect a drift where `reach verify <digest>` fails, please tag the issue as `type:determinism-drift`. These are prioritized as P0 by the engineering team.
