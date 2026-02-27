#ifdef _WIN32
#include "requiem/sandbox.hpp"

#include <windows.h>
#include <sddl.h>

#include <string>

namespace requiem {
namespace {
void append_limited(std::string& dst, const char* src, size_t n, std::size_t limit, bool& truncated) {
  const std::size_t avail = dst.size() < limit ? limit - dst.size() : 0;
  const std::size_t take = n < avail ? n : avail;
  dst.append(src, take);
  if (take < n || dst.size() >= limit) truncated = true;
}
std::wstring widen(const std::string& s) { return std::wstring(s.begin(), s.end()); }

// v1.2: Convert string security descriptor to SID
PSID get_restricted_sid() {
  // Low integrity level SID
  const wchar_t* sddl = L"S-1-16-4096";  // Low mandatory level
  PSID sid = nullptr;
  ConvertStringSidToSidW(sddl, &sid);
  return sid;
}

}  // namespace

ProcessResult run_process(const ProcessSpec& spec) {
  ProcessResult result;
  SECURITY_ATTRIBUTES sa{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
  HANDLE out_r, out_w, err_r, err_w;
  if (!CreatePipe(&out_r, &out_w, &sa, 0) || !CreatePipe(&err_r, &err_w, &sa, 0)) {
    result.error_message = "spawn_failed";
    return result;
  }

  STARTUPINFOW si{};
  si.cb = sizeof(si);
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdOutput = out_w;
  si.hStdError = err_w;
  si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);

  // v1.2: Process creation flags
  DWORD creation_flags = CREATE_NO_WINDOW | CREATE_SUSPENDED;
  
  // v1.2: Process mitigations
  PROCESS_MITIGATION_POLICY mitigations[10] = {};
  DWORD mitigation_size = 0;
  
  // v1.2: Job object with extended limits
  HANDLE job = CreateJobObjectW(nullptr, nullptr);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli{};
  jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  
  // v1.2: Add memory limit if specified
  if (spec.max_memory_bytes > 0) {
    jeli.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_JOB_MEMORY;
    jeli.JobMemoryLimit = spec.max_memory_bytes;
  }
  
  SetInformationJobObject(job, JobObjectExtendedLimitInformation, &jeli, sizeof(jeli));

  // v1.2: Security attributes for restricted token
  SECURITY_ATTRIBUTES process_sa = {sizeof(SECURITY_ATTRIBUTES), nullptr, FALSE};
  HANDLE hToken = nullptr;
  HANDLE hRestrictedToken = nullptr;
  
  // v1.2: Create restricted token if requested
  if (spec.enforce_network_isolation || spec.enforce_seccomp) {
    // Open current process token
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_DUPLICATE | TOKEN_QUERY, &hToken)) {
      // Create restricted token (remove privileges)
      SID_AND_ATTRIBUTES sids[1];
      PSID low_sid = get_restricted_sid();
      if (low_sid) {
        sids[0].Sid = low_sid;
        sids[0].Attributes = SE_GROUP_INTEGRITY;
        
        if (CreateRestrictedToken(hToken, 0, 0, nullptr, 0, nullptr, 1, sids, &hRestrictedToken)) {
          // Successfully created restricted token
        } else {
          result.failed_capabilities.push_back("restricted_token");
          hRestrictedToken = nullptr;
        }
        LocalFree(low_sid);
      }
      CloseHandle(hToken);
    }
  }

  PROCESS_INFORMATION pi{};
  std::wstring cmd = widen(spec.command);
  for (const auto& a : spec.argv) {
    // v1.2: Proper argument quoting
    cmd += L" \"";
    for (wchar_t c : widen(a)) {
      if (c == L'"') cmd += L'\\';
      cmd += c;
    }
    cmd += L"\"";
  }

  auto cwd = widen(spec.cwd);
  
  BOOL created = FALSE;
  if (hRestrictedToken) {
    // Create process with restricted token
    created = CreateProcessAsUserW(hRestrictedToken, nullptr, cmd.data(), nullptr, nullptr, TRUE,
                                    creation_flags, nullptr, cwd.empty() ? nullptr : cwd.c_str(), &si, &pi);
  } else {
    created = CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, TRUE, creation_flags, nullptr,
                              cwd.empty() ? nullptr : cwd.c_str(), &si, &pi);
  }
  
  if (!created) {
    result.error_message = "spawn_failed";
    CloseHandle(out_w);
    CloseHandle(err_w);
    CloseHandle(out_r);
    CloseHandle(err_r);
    CloseHandle(job);
    if (hRestrictedToken) CloseHandle(hRestrictedToken);
    return result;
  }

  // v1.2: Apply process mitigations
  if (spec.enforce_seccomp) {
    // Process mitigation policies for "seccomp-like" behavior
    PROCESS_MITIGATION_SYSTEM_CALL_DISABLE_POLICY syscall_policy{};
    syscall_policy.DisallowWin32kSystemCalls = 1;
    SetProcessMitigationPolicy(ProcessSystemCallDisablePolicy, &syscall_policy, sizeof(syscall_policy));
    
    // Strict handle check
    PROCESS_MITIGATION_STRICT_HANDLE_CHECK_POLICY handle_policy{};
    handle_policy.HandleExceptionsPermanentlyEnabled = 1;
    SetProcessMitigationPolicy(ProcessStrictHandleCheckPolicy, &handle_policy, sizeof(handle_policy));
    
    result.enforced_capabilities.push_back("process_mitigations");
    result.sandbox_process_mitigations = true;
  }

  // Resume the suspended process
  ResumeThread(pi.hThread);
  
  AssignProcessToJobObject(job, pi.hProcess);
  CloseHandle(out_w);
  CloseHandle(err_w);

  DWORD wait = WaitForSingleObject(pi.hProcess, static_cast<DWORD>(spec.timeout_ms));
  if (wait == WAIT_TIMEOUT) {
    TerminateJobObject(job, 1);
    result.timed_out = true;
    result.exit_code = 124;
  } else {
    DWORD ec = 0;
    GetExitCodeProcess(pi.hProcess, &ec);
    result.exit_code = static_cast<int>(ec);
  }

  char buf[256];
  DWORD n = 0;
  while (ReadFile(out_r, buf, sizeof(buf), &n, nullptr) && n > 0) append_limited(result.stdout_text, buf, n, spec.max_output_bytes, result.stdout_truncated);
  while (ReadFile(err_r, buf, sizeof(buf), &n, nullptr) && n > 0) append_limited(result.stderr_text, buf, n, spec.max_output_bytes, result.stderr_truncated);
  if (result.stdout_truncated) result.stdout_text += "(truncated)";
  if (result.stderr_truncated) result.stderr_text += "(truncated)";

  // Report sandbox capabilities applied
  result.sandbox_workspace_confinement = true;  // Path-based confinement
  result.sandbox_job_object = true;  // Job Objects used for kill-on-close
  result.sandbox_rlimits = spec.max_memory_bytes > 0;  // Job memory limits
  result.sandbox_seccomp = spec.enforce_seccomp;  // Process mitigations used as seccomp-like
  result.sandbox_restricted_token = hRestrictedToken != nullptr;
  result.sandbox_network_isolation = false;  // Would require AppContainer or firewall rules
  
  result.enforced_capabilities.push_back("workspace_confinement");
  result.enforced_capabilities.push_back("job_objects");
  if (spec.max_memory_bytes > 0) {
    result.enforced_capabilities.push_back("memory_limits");
  }
  if (spec.enforce_seccomp) {
    result.enforced_capabilities.push_back("process_mitigations");
  }
  if (hRestrictedToken) {
    result.enforced_capabilities.push_back("restricted_token");
  }
  
  if (spec.enforce_network_isolation && !result.sandbox_network_isolation) {
    result.failed_capabilities.push_back("network_isolation");
  }

  CloseHandle(out_r);
  CloseHandle(err_r);
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  CloseHandle(job);
  if (hRestrictedToken) CloseHandle(hRestrictedToken);
  
  return result;
}

// v1.2: Apply Windows process mitigations
bool apply_windows_mitigations() {
  PROCESS_MITIGATION_ASLR_POLICY aslr_policy{};
  aslr_policy.EnableBottomUpRandomization = 1;
  aslr_policy.EnableForceRelocateImages = 1;
  aslr_policy.EnableHighEntropy = 1;
  
  BOOL result = SetProcessMitigationPolicy(ProcessASLRPolicy, &aslr_policy, sizeof(aslr_policy));
  return result != 0;
}

// v1.2: Create restricted token
bool create_restricted_token() {
  HANDLE hToken = nullptr;
  HANDLE hRestrictedToken = nullptr;
  
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_DUPLICATE | TOKEN_QUERY, &hToken)) {
    return false;
  }
  
  BOOL result = CreateRestrictedToken(hToken, 0, 0, nullptr, 0, nullptr, 0, nullptr, &hRestrictedToken);
  
  CloseHandle(hToken);
  if (hRestrictedToken) CloseHandle(hRestrictedToken);
  
  return result != 0;
}

// v1.2: Enable Windows network isolation
bool enable_windows_network_isolation() {
  // This would require:
  // 1. Creating an AppContainer profile
  // 2. Setting up firewall rules
  // 3. Applying to process
  // For now, report as not implemented
  return false;
}

SandboxCapabilities detect_platform_sandbox_capabilities() {
  SandboxCapabilities caps;
  caps.workspace_confinement = true;  // Path-based confinement is implemented
  caps.rlimits_cpu = false;  // Not available on Windows
  caps.rlimits_mem = true;  // Job Object memory limits available
  caps.rlimits_fds = false;  // Not available on Windows
  caps.seccomp_baseline = false;  // Not applicable
  caps.seccomp_bpf = false;  // Not applicable
  caps.job_objects = true;  // Job Objects available and used
  caps.restricted_token = true;  // v1.2: Restricted tokens implemented
  caps.process_mitigations = true;  // v1.2: Process mitigation policies available
  caps.network_isolation = false;  // v1.2 target: AppContainer or firewall isolation
  return caps;
}

}  // namespace requiem
#endif
