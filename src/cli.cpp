#include <fstream>
#include <iostream>
#include <map>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"

namespace {
std::string read_file(const std::string& path) {
  std::ifstream ifs(path, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
}
void write_file(const std::string& path, const std::string& data) {
  std::ofstream ofs(path, std::ios::binary | std::ios::trunc);
  ofs << data;
}
requiem::ExecutionResult parse_result(const std::string& s) {
  requiem::ExecutionResult r;
  r.ok = requiem::jsonlite::get_bool(s, "ok", false);
  r.exit_code = static_cast<int>(requiem::jsonlite::get_u64(s, "exit_code", 0));
  r.termination_reason = requiem::jsonlite::get_string(s, "termination_reason", "");
  r.request_digest = requiem::jsonlite::get_string(s, "request_digest", "");
  r.trace_digest = requiem::jsonlite::get_string(s, "trace_digest", "");
  r.result_digest = requiem::jsonlite::get_string(s, "result_digest", "");
  r.stdout_text = requiem::jsonlite::get_string(s, "stdout", "");
  r.stderr_text = requiem::jsonlite::get_string(s, "stderr", "");
  r.output_digests = requiem::jsonlite::get_string_map(s, "output_digests");
  return r;
}
}

int main(int argc, char** argv) {
  if (argc < 2) return 1;
  std::string cmd = argv[1];
  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout << requiem::policy_explain(requiem::ExecPolicy{});
    return 0;
  }
  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "gc") {
    std::string cas_dir = ".requiem/cas"; bool as_json = false;
    for (int i = 3; i < argc; ++i) { if (std::string(argv[i]) == "--cas" && i + 1 < argc) cas_dir = argv[++i]; if (std::string(argv[i]) == "--json") as_json = true; }
    requiem::CasStore cas(cas_dir); auto objects = cas.scan_objects(); std::size_t total=0; for (const auto& o:objects) total += o.size;
    if (as_json) std::cout << "{\"dry_run\":true,\"count\":" << objects.size() << ",\"bytes\":" << total << "}\n";
    else std::cout << "dry-run objects=" << objects.size() << " bytes=" << total << "\n";
    return 0;
  }
  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string result_file; for (int i=3;i<argc;++i) if(std::string(argv[i])=="--result"&&i+1<argc) result_file=argv[++i];
    auto r = parse_result(read_file(result_file));
    if (requiem::deterministic_digest(requiem::canonicalize_result(r)) != r.result_digest) return 2;
    std::cout << "ok\n"; return 0;
  }
  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string in,out; for(int i=3;i<argc;++i){ if(std::string(argv[i])=="--request"&&i+1<argc)in=argv[++i]; if(std::string(argv[i])=="--out"&&i+1<argc)out=argv[++i]; }
    std::string err; auto req=requiem::parse_request_json(read_file(in), &err); if(!err.empty()&&req.command.empty()){ std::cerr<<err<<"\n"; return 2; }
    auto res=requiem::execute(req); write_file(out, requiem::result_to_json(res)); return res.ok?0:1;
  }
  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "replay") {
    std::string req_file,result_file,cas_dir=".requiem/cas"; for(int i=3;i<argc;++i){ if(std::string(argv[i])=="--request"&&i+1<argc)req_file=argv[++i]; if(std::string(argv[i])=="--result"&&i+1<argc)result_file=argv[++i]; if(std::string(argv[i])=="--cas"&&i+1<argc)cas_dir=argv[++i]; }
    auto req=requiem::parse_request_json(read_file(req_file), nullptr); auto r=parse_result(read_file(result_file)); requiem::CasStore cas(cas_dir); std::string e;
    if(!requiem::validate_replay_with_cas(req,r,cas,&e)){ std::cerr<<e<<"\n"; return 2; }
    std::cout<<"ok\n"; return 0;
  }
  if (cmd == "trace" && argc >= 3 && std::string(argv[2]) == "pretty") {
    std::string result_file; for(int i=3;i<argc;++i) if(std::string(argv[i])=="--result"&&i+1<argc) result_file=argv[++i];
    auto raw=read_file(result_file); requiem::ExecutionResult r; r.trace_events.push_back({1,0,"trace",{{"raw_digest",requiem::deterministic_digest(raw)}}});
    std::cout << requiem::trace_pretty(r); return 0;
  }
  if (cmd == "bench" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string spec_file,out_file; for(int i=3;i<argc;++i){ if(std::string(argv[i])=="--spec"&&i+1<argc) spec_file=argv[++i]; if(std::string(argv[i])=="--out"&&i+1<argc) out_file=argv[++i]; }
    auto spec=read_file(spec_file); int runs=static_cast<int>(requiem::jsonlite::get_u64(spec,"runs",1)); auto req=requiem::parse_request_json(spec,nullptr);
    std::map<std::string,int> freq; std::string body="{\"runs\":[";
    for(int i=0;i<runs;++i){ auto r=requiem::execute(req); if(i) body += ","; body += "{\"i\":"+std::to_string(i)+",\"result_digest\":\""+r.result_digest+"\"}"; freq[r.result_digest]++; }
    body += "],\"mismatch\":" + std::string(freq.size()>1?"true":"false") + "}";
    write_file(out_file, body+"\n"); return 0;
  }
  return 1;
}
