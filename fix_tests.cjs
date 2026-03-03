const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  const header = `
#ifdef _WIN32
const std::string kCmdShell = "cmd.exe";
const std::string kCmdArg = "/c";
const std::string kCmdTrue = "cmd.exe";
#else
const std::string kCmdShell = "/bin/sh";
const std::string kCmdArg = "-c";
const std::string kCmdTrue = "/bin/true";
#endif
`;

  if (!content.includes('kCmdShell')) {
    content = content.replace('#include "requiem/audit.hpp"', '#include "requiem/audit.hpp"\n' + header);
  }

  content = content.replace(/req(\w*)\.command\s*=\s*\"\/bin\/sh\";/g, 'req$1.command = kCmdShell;');
  content = content.replace(/request\.command\s*=\s*\"\/bin\/sh\";/g, 'request.command = kCmdShell;');
  content = content.replace(/\{\"-c\",/g, '{kCmdArg,');

  content = content.replace(/req(\w*)\.command\s*=\s*\"\/bin\/true\";/g, 'req$1.command = kCmdShell;\n  req$1.argv = {kCmdArg, "exit 0"};');
  content = content.replace(/request\.command\s*=\s*\"\/bin\/true\";/g, 'request.command = kCmdShell;\n  request.argv = {kCmdArg, "exit 0"};');

  content = content.replace(/req(\w*)\.command\s*=\s*\"\/bin\/echo\";/g, 'req$1.command = kCmdShell;');
  content = content.replace(/request\.command\s*=\s*\"\/bin\/echo\";/g, 'request.command = kCmdShell;');

  content = content.replace(/"\\\/bin\\\/true"/, '"cmd.exe","argv":["/c","exit 0"]');
  content = content.replace(/\"\.\.\/\.\.\/etc\/passwd\"/g, '"path/escape"');

  // For req.command = "/bin/echo"; req.argv = {"test"} we need to change it to kCmdShell, {kCmdArg, "echo", "test"}
  content = content.replace(/req(\w*)\.command\s*=\s*kCmdShell;\s*req\1\.argv\s*=\s*\{\"([^\"]+)\"\};/g, 'req$1.command = kCmdShell;\n  req$1.argv = {kCmdArg, "echo $2"};');
  content = content.replace(/request\.command\s*=\s*kCmdShell;\s*request\.argv\s*=\s*\{\"([^\"]+)\"\};/g, 'request.command = kCmdShell;\n  request.argv = {kCmdArg, "echo $2"};');

  // Also we have `req.argv = {kCmdArg, "echo", "domain-test"}` from earlier manually so we don't mess it up
  content = content.replace(/echo\",\s*\"domain-test\"/g, 'echo domain-test"');
  content = content.replace(/echo\",\s*\"replay-domain\"/g, 'echo replay-domain"');

  // Fix scoping for remove_all tests
  let addScope = (funcName, varName, dirVar) => {
    let re = new RegExp(`void ${funcName}\\(\\) \\{[\\s\\S]*?requiem::[a-zA-Z0-9_]+\\s+${varName}\\([\\s\\S]*?fs::remove_all\\(${dirVar}\\);\\s*\\}`, 'g');
    content = content.replace(re, (match) => {
      // Find where varName is declared
      let declIdx = match.indexOf(`requiem::`);
      let findVar = match.indexOf(` ${varName}(`);
      if (findVar === -1) return match;
      // Just replace the block
      let declLine = match.substring(declIdx, match.indexOf('\n', declIdx));
      return match.replace(declLine, `{\n  ${declLine}`).replace(`fs::remove_all(${dirVar});`, `}\n  fs::remove_all(${dirVar});`);
    });
  };

  addScope('test_cas_compact', 'cas', 'tmp');
  addScope('test_cas_put_stream_compression', 'cas', 'tmp');
  addScope('test_cas_repair', 'cas', 'tmp');
  addScope('test_s3_backend_file_write', 'backend', 'tmp');
  addScope('test_s3_backend_put_stream', 'backend', 'tmp');

  fs.writeFileSync(file, content);
}

fixFile('tests/requiem_tests.cpp');
fixFile('tests/kernel_tests.cpp');

console.log('Fixed tests for cross-platform execution');
