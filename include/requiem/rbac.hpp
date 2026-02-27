#pragma once

// requiem/rbac.hpp — Role-Based Access Control for Requiem cluster platform.
//
// DESIGN:
//   Every API call carries a TenantContext that includes an RBAC role.
//   Route handlers check required_role() before dispatching to the engine.
//   Engine calls are mediated exclusively through the Node API boundary.
//   No cross-tenant data is ever exposed regardless of role.
//
// ROLES (ordered by privilege, ascending):
//   viewer   — read-only access to public metrics and cluster status.
//   auditor  — viewer + audit log access + replay verification.
//   operator — auditor + execution submission + CAS management.
//   admin    — operator + worker management + cluster configuration.
//
// INVARIANTS:
//   - Role checks are mandatory on every authenticated route.
//   - Tenant isolation is enforced below RBAC: even admin cannot read another
//     tenant's data. Tenant boundary is cryptographically enforced by the auth layer.
//   - RBAC decisions are logged to the audit event stream.
//   - No role escalation without re-authentication.
//   - OSS build: RBAC is compiled in but not enforced (permissive mode).
//     Enterprise build: enforcement is strict (all checks fail-closed).
//
// EXTENSION_POINT: policy_engine
//   Current: static role hierarchy with bitfield comparison.
//   Upgrade: replace with OPA (Open Policy Agent) Rego policies for
//   attribute-based access control (ABAC). The check() interface is stable.

#include <cstdint>
#include <string>
#include <optional>

namespace requiem {
namespace rbac {

// ---------------------------------------------------------------------------
// Role — ordered privilege levels (viewer=0 < auditor=1 < operator=2 < admin=3)
// ---------------------------------------------------------------------------
enum class Role : uint8_t {
  viewer   = 0,
  auditor  = 1,
  operator_ = 2,  // trailing underscore avoids C++ keyword conflict
  admin    = 3,
};

// Parse role from string. Returns nullopt on unrecognized value.
std::optional<Role> role_from_string(const std::string& s);

// Serialize role to canonical string.
std::string role_to_string(Role r);

// ---------------------------------------------------------------------------
// Permission — what each role may do on which resource
// ---------------------------------------------------------------------------
// Each Permission maps to a set of roles that may perform it.
// Use has_permission(role, permission) to check access.
enum class Permission {
  // Cluster read
  cluster_status_read,       // viewer+
  cluster_workers_read,      // viewer+
  cluster_drift_read,        // auditor+

  // Engine read
  engine_metrics_read,       // viewer+
  engine_status_read,        // viewer+
  engine_diagnostics_read,   // auditor+
  engine_analyze_read,       // auditor+

  // Execution
  execution_submit,          // operator+
  execution_replay,          // auditor+

  // Audit
  audit_log_read,            // auditor+

  // CAS
  cas_read,                  // auditor+
  cas_write,                 // operator+
  cas_verify,                // auditor+

  // Cluster management
  cluster_worker_join,       // operator+
  cluster_worker_evict,      // admin only
  cluster_config_change,     // admin only

  // Release
  release_verify,            // operator+
};

// Returns true if the given role has the given permission.
// Fail-closed: unknown role → false.
bool has_permission(Role role, Permission permission);

// ---------------------------------------------------------------------------
// RbacContext — result of an RBAC check
// ---------------------------------------------------------------------------
struct RbacContext {
  bool   ok{false};
  Role   role{Role::viewer};
  std::string tenant_id;
  std::string denial_reason;  // non-empty if !ok

  // Convenience: returns an audit log-friendly summary.
  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// check — evaluate role permission
// ---------------------------------------------------------------------------
// Checks if the given role has the given permission for the given tenant.
// Logs the check to the structured event stream.
// Never throws.
RbacContext check(const std::string& tenant_id,
                  Role               role,
                  Permission         permission);

// ---------------------------------------------------------------------------
// Role extraction from request header
// ---------------------------------------------------------------------------
// Reads the X-Requiem-Role header. Falls back to viewer if absent/invalid.
// Used by the Node API boundary to derive RBAC context from incoming requests.
Role role_from_header(const std::string& header_value);

// ---------------------------------------------------------------------------
// ClusterAuthVersion — node-to-node authentication scheme version.
// ---------------------------------------------------------------------------
// Stamped into WorkerIdentity to detect incompatible auth protocol mismatches
// in heterogeneous deployments.
//
// EXTENSION_POINT: node_auth_upgrade
//   Current: version 1 = bearer token stub (no cryptographic inter-node auth).
//   Upgrade path:
//     version 2 = mutual TLS with self-signed cluster CA.
//     version 3 = SPIFFE/SPIRE SVID-based workload identity.
//   Invariant: nodes with mismatched auth_version must refuse to form a cluster.
//   Startup fails if auth_version mismatch detected in ClusterRegistry.
static constexpr uint32_t CLUSTER_AUTH_VERSION = 1;

// ---------------------------------------------------------------------------
// NodeAuthToken — stub for inter-node authentication
// ---------------------------------------------------------------------------
// In the current implementation this is a placeholder. When node_auth_upgrade
// is activated, this struct carries the SVID or mTLS certificate material.
struct NodeAuthToken {
  uint32_t    auth_version{CLUSTER_AUTH_VERSION};
  std::string node_id;
  std::string token;  // stub: would be a signed JWT or TLS fingerprint
  uint64_t    issued_at_unix_ms{0};
  uint64_t    expires_at_unix_ms{0};

  // Verify: returns true if token is structurally valid and not expired.
  // In production this would validate a cryptographic signature.
  bool verify_stub(const std::string& expected_node_id) const;

  std::string to_json() const;
};

}  // namespace rbac
}  // namespace requiem
