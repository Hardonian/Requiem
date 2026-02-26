#ifdef _WIN32
#include "requiem/sandbox.hpp"
namespace requiem {
ProcessResult run_process(const ProcessSpec&) {
  ProcessResult r;
  r.error_message = "not_implemented_on_windows";
  r.exit_code = 127;
  return r;
}
}  // namespace requiem
#endif
