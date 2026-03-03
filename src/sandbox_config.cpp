#include "requiem/sandbox.hpp"

#include <cstdlib>
#include <cstring>

namespace requiem {

namespace {

SandboxConfig& mutable_sandbox_config() {
  static SandboxConfig cfg = SandboxConfig::from_env();
  return cfg;
}

bool& sandbox_config_locked() {
  static bool locked = false;
  return locked;
}

}  // namespace

SandboxConfig SandboxConfig::from_env() {
  SandboxConfig cfg;
  const char* disabled = std::getenv("REQUIEM_SANDBOX_DISABLED");
  if (disabled == nullptr) {
    return cfg;
  }

  if (std::strcmp(disabled, "1") == 0 ||
      std::strcmp(disabled, "true") == 0 ||
      std::strcmp(disabled, "TRUE") == 0) {
    cfg.sandbox_enabled = false;
  }
  return cfg;
}

void init_sandbox_config(const SandboxConfig& config) {
  if (sandbox_config_locked()) {
    return;
  }
  mutable_sandbox_config() = config;
  sandbox_config_locked() = true;
}

const SandboxConfig& global_sandbox_config() {
  return mutable_sandbox_config();
}

}  // namespace requiem
