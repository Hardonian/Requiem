#ifdef _WIN32
#include "requiem/sandbox.hpp"

#include <windows.h>

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

  PROCESS_INFORMATION pi{};
  std::wstring cmd = widen(spec.command);
  for (const auto& a : spec.argv) cmd += L" \"" + widen(a) + L"\"";

  HANDLE job = CreateJobObjectW(nullptr, nullptr);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli{};
  jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  SetInformationJobObject(job, JobObjectExtendedLimitInformation, &jeli, sizeof(jeli));

  auto cwd = widen(spec.cwd);
  if (!CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, cwd.empty() ? nullptr : cwd.c_str(), &si, &pi)) {
    result.error_message = "spawn_failed";
    return result;
  }
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

  CloseHandle(out_r);
  CloseHandle(err_r);
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  CloseHandle(job);
  return result;
}
}  // namespace requiem
#endif
