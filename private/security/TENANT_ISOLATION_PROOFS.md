# Tenant Isolation Proofs: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Objective

This document outlines the cryptographic and structural proofs used to ensure that data from one tenant cannot be accessed or influenced by another tenant within the Requiem runtime.

## 2. Cryptographic Isolation (Domain Separation)

Requiem uses **BLAKE3 Keyed Hashing** for all artifact indexing. 

- **Key Derivation**: For each tenant, we derive a unique `DomainKey` using `HKDF(MasterSecret, TenantID)`.
- **Commitment**: All hashes generated for a tenant use their specific `DomainKey`. 
- **Proof**: Even if a tenant knows the hash of a file in another tenant's CAS, they cannot retrieve it because the storage lookup requires a matching `DomainKey` commitment.

## 3. Runtime Separation (Sandboxing)

Each `reach run` instantiation occurs in a isolated process namespace.

- **PID Namespace**: The agent cannot see other running processes.
- **Environment Scrubbing**: Every environment variable is stripped. Only the allow-listed tokens for that specific tenant/request are injected.
- **Verification**: We use the `reach tenant-check` suite in our CI to attempt cross-tenant access and verify that the Policy VM blocks it with 100% success rate.

## 4. CAS Data Locality

In the Enterprise tier, tenants can opt for physical data isolation.

- **S3 Bucket Mapping**: `TenantID_A` -> `bucket-enterprise-a`.
- **Identity Enforcement**: The ReadyLayer control plane verifies the JWT (JSON Web Token) claims against the requested storage path before issuing a signed URL for artifact retrieval.

## 5. Formal Verification

The core transition logic for tenant context switching is specified in TLA+. This ensures that there are no logical "leak" states where a `ContextID` from one request is accidentally used for a tool call in another.
