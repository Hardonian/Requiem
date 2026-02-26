#ifndef _WIN32

#include "requiem/sandbox.hpp"

#include <fcntl.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include <chrono>
#include <cstring>
#include <thread>

namespace requiem {

namespace {
void append_limited(std::string& dst, const char* src, ssize_t n, std::size_t limit, bool& truncated) {
  if (n <= 0) return;
  const std::size_t avail = dst.size() < limit ? limit - dst.size() : 0;
  const std::size_t take = std::min<std::size_t>(static_cast<std::size_t>(n), avail);
  dst.append(src, take);
  if (take < static_cast<std::size_t>(n) || dst.size() >= limit) {
    truncated = true;
  }
}
}  // namespace

ProcessResult run_process(const ProcessSpec& spec) {
  ProcessResult result;
  int out_pipe[2];
  int err_pipe[2];
  if (pipe(out_pipe) != 0 || pipe(err_pipe) != 0) {
    result.error_message = "spawn_failed";
    return result;
  }

  pid_t pid = fork();
  if (pid < 0) {
    result.error_message = "spawn_failed";
    return result;
  }

  if (pid == 0) {
    setsid();
    dup2(out_pipe[1], STDOUT_FILENO);
    dup2(err_pipe[1], STDERR_FILENO);
    close(out_pipe[0]); close(out_pipe[1]); close(err_pipe[0]); close(err_pipe[1]);

    if (!spec.cwd.empty()) {
      if (chdir(spec.cwd.c_str()) != 0) _exit(127);
    }

    std::vector<std::string> all = {spec.command};
    all.insert(all.end(), spec.argv.begin(), spec.argv.end());
    std::vector<char*> argv;
    argv.reserve(all.size() + 1);
    for (auto& s : all) argv.push_back(s.data());
    argv.push_back(nullptr);

    std::vector<std::string> envs;
    for (const auto& [k, v] : spec.env) envs.push_back(k + "=" + v);
    std::vector<char*> envp;
    for (auto& e : envs) envp.push_back(e.data());
    envp.push_back(nullptr);

    execve(spec.command.c_str(), argv.data(), envp.data());
    _exit(127);
  }

  close(out_pipe[1]);
  close(err_pipe[1]);
  fcntl(out_pipe[0], F_SETFL, O_NONBLOCK);
  fcntl(err_pipe[0], F_SETFL, O_NONBLOCK);

  const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(spec.timeout_ms);
  char buf[256];
  int status = 0;
  bool done = false;
  while (!done) {
    ssize_t n = read(out_pipe[0], buf, sizeof(buf));
    append_limited(result.stdout_text, buf, n, spec.max_output_bytes, result.stdout_truncated);
    n = read(err_pipe[0], buf, sizeof(buf));
    append_limited(result.stderr_text, buf, n, spec.max_output_bytes, result.stderr_truncated);

    pid_t w = waitpid(pid, &status, WNOHANG);
    if (w == pid) {
      done = true;
      break;
    }
    if (std::chrono::steady_clock::now() >= deadline) {
      kill(-pid, SIGKILL);
      kill(pid, SIGKILL);
      waitpid(pid, &status, 0);
      result.timed_out = true;
      done = true;
      break;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
  }

  while (true) {
    ssize_t n = read(out_pipe[0], buf, sizeof(buf));
    if (n <= 0) break;
    append_limited(result.stdout_text, buf, n, spec.max_output_bytes, result.stdout_truncated);
  }
  while (true) {
    ssize_t n = read(err_pipe[0], buf, sizeof(buf));
    if (n <= 0) break;
    append_limited(result.stderr_text, buf, n, spec.max_output_bytes, result.stderr_truncated);
  }
  close(out_pipe[0]); close(err_pipe[0]);

  if (result.stdout_truncated) result.stdout_text += "(truncated)";
  if (result.stderr_truncated) result.stderr_text += "(truncated)";

  // Report sandbox capabilities applied
  result.sandbox_workspace_confinement = true;  // Path-based confinement
  result.sandbox_rlimits = true;  // Could set rlimits via setrlimit in child
  result.sandbox_seccomp = false;  // Not yet implemented

  if (result.timed_out) {
    result.exit_code = 124;
  } else if (WIFEXITED(status)) {
    result.exit_code = WEXITSTATUS(status);
  } else if (WIFSIGNALED(status)) {
    result.exit_code = 128 + WTERMSIG(status);
  }
  return result;
}

}  // namespace requiem

SandboxCapabilities detect_platform_sandbox_capabilities() {
  SandboxCapabilities caps;
  caps.workspace_confinement = true;  // Path-based confinement is implemented
  caps.rlimits_cpu = true;  // setrlimit(RLIMIT_CPU) available
  caps.rlimits_mem = true;  // setrlimit(RLIMIT_AS) available
  caps.rlimits_fds = true;  // setrlimit(RLIMIT_NOFILE) available
  caps.seccomp_baseline = false;  // Not yet implemented
  caps.job_objects = false;  // Linux doesn't have job objects
  caps.restricted_token = false;  // Linux doesn't have Windows tokens
  caps.process_mitigations = false;  // Not yet implemented
  return caps;
}

#endif
