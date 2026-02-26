#pragma once

#include <map>
#include <regex>
#include <string>
#include <vector>

namespace requiem::jsonlite {

inline std::string unescape(const std::string& in) {
  std::string o;
  for (size_t i=0;i<in.size();++i) {
    if (in[i]=='\\' && i+1<in.size()) {
      char n=in[++i];
      if (n=='n') o += '\n';
      else if (n=='"') o += '"';
      else o += n;
    } else o += in[i];
  }
  return o;
}

inline std::string get_string(const std::string& s, const std::string& key, const std::string& def = "") {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
  std::smatch m;
  if (std::regex_search(s, m, re)) return unescape(m[1].str());
  return def;
}

inline bool get_bool(const std::string& s, const std::string& key, bool def = false) {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*(true|false)");
  std::smatch m;
  if (std::regex_search(s, m, re)) return m[1].str() == "true";
  return def;
}

inline unsigned long long get_u64(const std::string& s, const std::string& key, unsigned long long def = 0) {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*([0-9]+)");
  std::smatch m;
  if (std::regex_search(s, m, re)) return std::stoull(m[1].str());
  return def;
}

inline std::vector<std::string> get_string_array(const std::string& s, const std::string& key) {
  std::vector<std::string> out;
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\[([^\\]]*)\\]");
  std::smatch m;
  if (!std::regex_search(s, m, re)) return out;
  std::regex item("\\\"([^\\\"]*)\\\"");
  auto begin = std::sregex_iterator(m[1].first, m[1].second, item);
  auto end = std::sregex_iterator();
  for (auto it = begin; it != end; ++it) out.push_back(unescape((*it)[1].str()));
  return out;
}

inline std::map<std::string, std::string> get_string_map(const std::string& s, const std::string& key) {
  std::map<std::string, std::string> out;
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\{([^\\}]*)\\}");
  std::smatch m;
  if (!std::regex_search(s, m, re)) return out;
  std::regex item("\\\"([^\\\"]*)\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
  auto begin = std::sregex_iterator(m[1].first, m[1].second, item);
  auto end = std::sregex_iterator();
  for (auto it = begin; it != end; ++it) out[unescape((*it)[1].str())] = unescape((*it)[2].str());
  return out;
}

inline std::string escape(const std::string& s) {
  std::string o;
  for (char c : s) {
    if (c == '"') o += "\\\"";
    else if (c == '\n') o += "\\n";
    else o += c;
  }
  return o;
}

}  // namespace requiem::jsonlite
