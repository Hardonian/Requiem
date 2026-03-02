#include "requiem/receipt.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/version.hpp"

namespace requiem {

// ---------------------------------------------------------------------------// Compute engine fingerprint: H(kernel_version || schema_version || hash_algo_version)
// This binds the receipt to the specific engine state that produced it.
// ---------------------------------------------------------------------------
static std::string compute_engine_fingerprint() {
  std::string input = std::to_string(version::ENGINE_ABI_VERSION) + "|" +
                      std::to_string(version::HASH_ALGORITHM_VERSION) + "|" +
                      std::to_string(version::CAS_FORMAT_VERSION);
  return hash_domain("fgrp:", input);
}

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

std::string receipt_compute_hash(const Receipt &receipt) {
  // Canonical JSON of all fields EXCEPT receipt_hash.
  jsonlite::Object obj;
  obj["engine_fingerprint"] = receipt.engine_fingerprint;
  obj["event_log_prev"] = receipt.event_log_prev;
  obj["event_log_seq"] = receipt.event_log_seq;
  obj["plan_hash"] = receipt.plan_hash;
  obj["receipt_version"] = static_cast<uint64_t>(receipt.receipt_version);
  obj["request_digest"] = receipt.request_digest;
  obj["result_digest"] = receipt.result_digest;
  obj["run_id"] = receipt.run_id;

  jsonlite::Object step_obj;
  for (const auto &[k, v] : receipt.step_digests)
    step_obj[k] = jsonlite::Value{v};
  obj["step_digests"] = std::move(step_obj);

  return hash_domain("rcpt:",
                     jsonlite::to_json(jsonlite::Value{std::move(obj)}));
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

Receipt receipt_generate(const std::string &run_id,
                         const std::string &plan_hash,
                         const std::string &request_digest,
                         const std::string &result_digest,
                         const std::map<std::string, std::string> &step_digests,
                         uint64_t event_log_seq,
                         const std::string &event_log_prev) {

  Receipt receipt;
  receipt.receipt_version = 1;
  receipt.run_id = run_id;
  receipt.plan_hash = plan_hash;
  receipt.request_digest = request_digest;
  receipt.result_digest = result_digest;
  receipt.step_digests = step_digests;
  receipt.event_log_seq = event_log_seq;
  receipt.event_log_prev = event_log_prev;
  // Bind receipt to engine state
  receipt.engine_fingerprint = compute_engine_fingerprint();
  receipt.receipt_hash = receipt_compute_hash(receipt);

  return receipt;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

ReceiptVerifyResult receipt_verify(const Receipt &receipt) {
  ReceiptVerifyResult result;

  if (receipt.receipt_version != 1) {
    result.error = "unsupported_receipt_version";
    return result;
  }

  // Verify engine fingerprint matches current engine state
  std::string current_fingerprint = compute_engine_fingerprint();
  if (receipt.engine_fingerprint != current_fingerprint) {
    result.error = "engine_fingerprint_mismatch: expected=" + current_fingerprint +
                   " actual=" + receipt.engine_fingerprint;
    return result;
  }

  std::string expected = receipt_compute_hash(receipt);
  if (expected != receipt.receipt_hash) {
    result.error = "receipt_hash_mismatch: expected=" + expected +
                   " actual=" + receipt.receipt_hash;
    return result;
  }

  result.ok = true;
  return result;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

std::string receipt_to_json(const Receipt &receipt) {
  jsonlite::Object obj;
  obj["engine_fingerprint"] = receipt.engine_fingerprint;
  obj["event_log_prev"] = receipt.event_log_prev;
  obj["event_log_seq"] = receipt.event_log_seq;
  obj["plan_hash"] = receipt.plan_hash;
  obj["receipt_hash"] = receipt.receipt_hash;
  obj["receipt_version"] = static_cast<uint64_t>(receipt.receipt_version);
  obj["request_digest"] = receipt.request_digest;
  obj["result_digest"] = receipt.result_digest;
  obj["run_id"] = receipt.run_id;

  jsonlite::Object step_obj;
  for (const auto &[k, v] : receipt.step_digests)
    step_obj[k] = jsonlite::Value{v};
  obj["step_digests"] = std::move(step_obj);

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

Receipt receipt_from_json(const std::string &json) {
  Receipt receipt;
  auto obj = jsonlite::parse(json, nullptr);

  receipt.receipt_version =
      static_cast<uint32_t>(jsonlite::get_u64(obj, "receipt_version", 1));
  receipt.run_id = jsonlite::get_string(obj, "run_id", "");
  receipt.plan_hash = jsonlite::get_string(obj, "plan_hash", "");
  receipt.request_digest = jsonlite::get_string(obj, "request_digest", "");
  receipt.result_digest = jsonlite::get_string(obj, "result_digest", "");
  receipt.event_log_seq = jsonlite::get_u64(obj, "event_log_seq", 0);
  receipt.event_log_prev = jsonlite::get_string(obj, "event_log_prev", "");
  receipt.receipt_hash = jsonlite::get_string(obj, "receipt_hash", "");
  receipt.engine_fingerprint = jsonlite::get_string(obj, "engine_fingerprint", "");
  receipt.step_digests = jsonlite::get_string_map(obj, "step_digests");

  return receipt;
}

// ---------------------------------------------------------------------------
// PHASE A: Receipt store operations
// ---------------------------------------------------------------------------

struct ReceiptStore {
  std::map<std::string, Receipt> receipts;  // receipt_hash -> receipt
};

static ReceiptStore& receipt_store() {
  static ReceiptStore store;
  return store;
}

Receipt receipt_get_by_hash(const std::string& receipt_hash) {
  auto it = receipt_store().receipts.find(receipt_hash);
  if (it != receipt_store().receipts.end()) {
    return it->second;
  }
  
  // Return an empty receipt if not found
  Receipt empty;
  empty.receipt_hash = receipt_hash;
  return empty;
}

} // namespace requiem
