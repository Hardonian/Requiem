#pragma once

// requiem/receipt.hpp — Execution receipts with cryptographic proof.
//
// KERNEL_SPEC §11: After every plan run (or individual exec), generate a
// receipt anchored in the event log, verifiable and replay-provable.
//
// INVARIANTS:
//   INV-REPLAY: replay(same_inputs) → identical receipt_hash.

#include <cstdint>
#include <map>
#include <string>

namespace requiem {

// A receipt proving an execution occurred with specific digests.
struct Receipt {
  uint32_t receipt_version{1};
  std::string run_id;
  std::string plan_hash;
  std::string request_digest;
  std::string result_digest;
  std::map<std::string, std::string> step_digests;
  uint64_t event_log_seq{0};
  std::string event_log_prev;
  std::string
      receipt_hash; // H("rcpt:", canonical_json(this_without_receipt_hash))
};

// Generate a receipt from execution data.
// Computes receipt_hash from all fields except receipt_hash itself.
Receipt receipt_generate(const std::string &run_id,
                         const std::string &plan_hash,
                         const std::string &request_digest,
                         const std::string &result_digest,
                         const std::map<std::string, std::string> &step_digests,
                         uint64_t event_log_seq,
                         const std::string &event_log_prev);

// Verify a receipt's integrity.
// Re-computes receipt_hash and checks it matches.
struct ReceiptVerifyResult {
  bool ok{false};
  std::string error;
};
ReceiptVerifyResult receipt_verify(const Receipt &receipt);

// Serialize a receipt to JSON.
std::string receipt_to_json(const Receipt &receipt);

// Parse a receipt from JSON.
Receipt receipt_from_json(const std::string &json);

// Compute the receipt hash: H("rcpt:",
// canonical_json(fields_without_receipt_hash))
std::string receipt_compute_hash(const Receipt &receipt);

} // namespace requiem
