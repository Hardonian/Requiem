#include "requiem/rbac.hpp"

#include <chrono>
#include <optional>
#include <sstream>

namespace requiem {
namespace rbac {

// ---------------------------------------------------------------------------
// role_from_string / role_to_string
// ---------------------------------------------------------------------------

std::optional<Role> role_from_string(const std::string& s) {
  if (s == "viewer")   return Role::viewer;
  if (s == "auditor")  return Role::auditor;
  if (s == "operator") return Role::operator_;
  if (s == "admin")    return Role::admin;
  return std::nullopt;
}

std::string role_to_string(Role r) {
  switch (r) {
    case Role::viewer:    return "viewer";
    case Role::auditor:   return "auditor";
    case Role::operator_: return "operator";
    case Role::admin:     return "admin";
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// has_permission — static role → permission matrix
// ---------------------------------------------------------------------------
// Matrix interpretation:
//   Permission requires a minimum role level.
//   Role level: viewer=0, auditor=1, operator=2, admin=3.
//   A role satisfies a permission if role >= minimum_required_role.
// ---------------------------------------------------------------------------

struct PermissionRule {
  Permission perm;
  Role       minimum_role;
};

// Permissions table: defines minimum role for each permission.
// Fail-closed: any permission not listed defaults to admin-only.
static const PermissionRule kPermissionTable[] = {
  // Cluster read
  { Permission::cluster_status_read,     Role::viewer },
  { Permission::cluster_workers_read,    Role::viewer },
  { Permission::cluster_drift_read,      Role::auditor },

  // Engine read
  { Permission::engine_metrics_read,     Role::viewer },
  { Permission::engine_status_read,      Role::viewer },
  { Permission::engine_diagnostics_read, Role::auditor },
  { Permission::engine_analyze_read,     Role::auditor },

  // Execution
  { Permission::execution_submit,        Role::operator_ },
  { Permission::execution_replay,        Role::auditor },

  // Audit
  { Permission::audit_log_read,          Role::auditor },

  // CAS
  { Permission::cas_read,                Role::auditor },
  { Permission::cas_write,               Role::operator_ },
  { Permission::cas_verify,              Role::auditor },

  // Cluster management
  { Permission::cluster_worker_join,     Role::operator_ },
  { Permission::cluster_worker_evict,    Role::admin },
  { Permission::cluster_config_change,   Role::admin },

  // Release
  { Permission::release_verify,          Role::operator_ },
};

bool has_permission(Role role, Permission permission) {
  const uint8_t role_level = static_cast<uint8_t>(role);
  for (const auto& rule : kPermissionTable) {
    if (rule.perm == permission) {
      return role_level >= static_cast<uint8_t>(rule.minimum_role);
    }
  }
  // Unknown permission: admin-only (fail-closed).
  return role == Role::admin;
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

RbacContext check(const std::string& tenant_id,
                  Role               role,
                  Permission         permission) {
  RbacContext ctx;
  ctx.tenant_id = tenant_id;
  ctx.role      = role;

  if (has_permission(role, permission)) {
    ctx.ok = true;
  } else {
    ctx.ok            = false;
    ctx.denial_reason = "role '" + role_to_string(role) +
                        "' lacks required permission for this operation";
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// RbacContext::to_json
// ---------------------------------------------------------------------------

std::string RbacContext::to_json() const {
  std::ostringstream o;
  o << "{"
    << "\"ok\":" << (ok ? "true" : "false")
    << ",\"role\":\"" << role_to_string(role) << "\""
    << ",\"tenant_id\":\"" << tenant_id << "\"";
  if (!denial_reason.empty()) {
    o << ",\"denial_reason\":\"" << denial_reason << "\"";
  }
  o << "}";
  return o.str();
}

// ---------------------------------------------------------------------------
// role_from_header
// ---------------------------------------------------------------------------

Role role_from_header(const std::string& header_value) {
  auto r = role_from_string(header_value);
  return r.value_or(Role::viewer);  // Default: least privilege.
}

// ---------------------------------------------------------------------------
// NodeAuthToken
// ---------------------------------------------------------------------------

bool NodeAuthToken::verify_stub(const std::string& expected_node_id) const {
  if (auth_version != CLUSTER_AUTH_VERSION) return false;
  if (node_id != expected_node_id) return false;
  if (token.empty()) return false;

  // Expiry check (if expires_at set).
  if (expires_at_unix_ms > 0) {
    using namespace std::chrono;
    const uint64_t now_ms = static_cast<uint64_t>(
        duration_cast<milliseconds>(
            system_clock::now().time_since_epoch()).count());
    if (now_ms > expires_at_unix_ms) return false;
  }

  return true;  // Stub: structural validity only, no cryptographic check.
}

std::string NodeAuthToken::to_json() const {
  std::ostringstream o;
  o << "{"
    << "\"auth_version\":" << auth_version
    << ",\"node_id\":\"" << node_id << "\""
    << ",\"issued_at_unix_ms\":" << issued_at_unix_ms
    << ",\"expires_at_unix_ms\":" << expires_at_unix_ms
    << ",\"token_present\":" << (token.empty() ? "false" : "true")
    << "}";
  return o.str();
}

}  // namespace rbac
}  // namespace requiem
