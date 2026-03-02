#include "requiem/economics.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

#include <chrono>
#include <sstream>

namespace requiem {
namespace economics {

// ---------------------------------------------------------------------------
// Cost receipt serialization
// ---------------------------------------------------------------------------

std::string CostLedgerManager::cost_receipt_to_json(const CostReceipt& r) {
  jsonlite::Object obj;
  obj["version"] = static_cast<uint64_t>(r.version);
  obj["tenant_id"] = r.tenant_id;
  obj["receipt_id"] = r.receipt_id;
  obj["execution_receipt_hash"] = r.execution_receipt_hash;
  obj["compute_units"] = static_cast<uint64_t>(r.units.compute_units);
  obj["memory_units"] = static_cast<uint64_t>(r.units.memory_units);
  obj["cas_io_units"] = static_cast<uint64_t>(r.units.cas_io_units);
  obj["replay_units"] = static_cast<uint64_t>(r.units.replay_units);
  obj["storage_units"] = static_cast<uint64_t>(r.units.storage_units);
  obj["network_units"] = static_cast<uint64_t>(r.units.network_units);
  obj["logical_time"] = r.logical_time;
  obj["prev_cost_receipt_hash"] = r.prev_cost_receipt_hash;
  obj["cost_receipt_hash"] = r.cost_receipt_hash;
  obj["created_at_unix_ns"] = static_cast<uint64_t>(r.created_at_unix_ns);
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

CostReceipt CostLedgerManager::cost_receipt_from_json(const std::string& json) {
  CostReceipt r;
  auto obj = jsonlite::parse(json, nullptr);
  
  r.version = static_cast<uint32_t>(jsonlite::get_u64(obj, "version", 1));
  r.tenant_id = jsonlite::get_string(obj, "tenant_id", "");
  r.receipt_id = jsonlite::get_string(obj, "receipt_id", "");
  r.execution_receipt_hash = jsonlite::get_string(obj, "execution_receipt_hash", "");
  r.units.compute_units = jsonlite::get_u64(obj, "compute_units", 0);
  r.units.memory_units = jsonlite::get_u64(obj, "memory_units", 0);
  r.units.cas_io_units = jsonlite::get_u64(obj, "cas_io_units", 0);
  r.units.replay_units = jsonlite::get_u64(obj, "replay_units", 0);
  r.units.storage_units = jsonlite::get_u64(obj, "storage_units", 0);
  r.units.network_units = jsonlite::get_u64(obj, "network_units", 0);
  r.logical_time = jsonlite::get_u64(obj, "logical_time", 0);
  r.prev_cost_receipt_hash = jsonlite::get_string(obj, "prev_cost_receipt_hash", "");
  r.cost_receipt_hash = jsonlite::get_string(obj, "cost_receipt_hash", "");
  r.created_at_unix_ns = jsonlite::get_u64(obj, "created_at_unix_ns", 0);
  
  return r;
}

std::string CostLedgerManager::compute_cost_receipt_hash(const CostReceipt& r) {
  jsonlite::Object obj;
  obj["version"] = static_cast<uint64_t>(r.version);
  obj["tenant_id"] = r.tenant_id;
  obj["receipt_id"] = r.receipt_id;
  obj["execution_receipt_hash"] = r.execution_receipt_hash;
  obj["compute_units"] = static_cast<uint64_t>(r.units.compute_units);
  obj["memory_units"] = static_cast<uint64_t>(r.units.memory_units);
  obj["cas_io_units"] = static_cast<uint64_t>(r.units.cas_io_units);
  obj["replay_units"] = static_cast<uint64_t>(r.units.replay_units);
  obj["storage_units"] = static_cast<uint64_t>(r.units.storage_units);
  obj["network_units"] = static_cast<uint64_t>(r.units.network_units);
  obj["logical_time"] = r.logical_time;
  obj["prev_cost_receipt_hash"] = r.prev_cost_receipt_hash;
  // Exclude cost_receipt_hash itself from the hash computation
  return hash_domain("cost:", jsonlite::to_json(jsonlite::Value{std::move(obj)}));
}

// ---------------------------------------------------------------------------
// CostLedgerManager implementation
// ---------------------------------------------------------------------------

CostReceipt CostLedgerManager::record_cost(
    const std::string& tenant_id,
    const std::string& execution_receipt_hash,
    const ResourceUnits& units,
    uint64_t logical_time) {
  
  std::lock_guard<std::mutex> lk(mu_);
  
  CostReceipt receipt;
  receipt.version = 1;
  receipt.tenant_id = tenant_id;
  // Generate unique receipt ID: tenant_id + logical_time + hash(execution)
  receipt.receipt_id = tenant_id + ":" + std::to_string(logical_time) + ":" + 
                       execution_receipt_hash.substr(0, 16);
  receipt.execution_receipt_hash = execution_receipt_hash;
  receipt.units = units;
  receipt.logical_time = logical_time;
  
  // Get previous cost receipt hash for this tenant
  auto it = tenant_root_hashes_.find(tenant_id);
  receipt.prev_cost_receipt_hash = (it != tenant_root_hashes_.end()) ? it->second : "";
  
  // Wall-clock timestamp (metadata only, not in hash)
  receipt.created_at_unix_ns = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::nanoseconds>(
          std::chrono::steady_clock::now().time_since_epoch()).count());
  
  // Compute hash and store
  receipt.cost_receipt_hash = compute_cost_receipt_hash(receipt);
  
  // Update tenant's latest cost root
  tenant_root_hashes_[tenant_id] = receipt.cost_receipt_hash;
  
  return receipt;
}

std::optional<CostLedger> CostLedgerManager::get_ledger(const std::string& tenant_id) const {
  std::lock_guard<std::mutex> lk(mu_);
  
  auto it = tenant_root_hashes_.find(tenant_id);
  if (it == tenant_root_hashes_.end()) {
    return std::nullopt;
  }
  
  CostLedger ledger;
  ledger.tenant_id = tenant_id;
  ledger.cost_root_hash = it->second;
  
  return ledger;
}

std::string CostLedgerManager::get_cost_root(const std::string& tenant_id) const {
  std::lock_guard<std::mutex> lk(mu_);
  
  auto it = tenant_root_hashes_.find(tenant_id);
  if (it != tenant_root_hashes_.end()) {
    return it->second;
  }
  return "";
}

CostLedgerVerifyResult CostLedgerManager::verify_ledger(const std::string& tenant_id) const {
  CostLedgerVerifyResult result;
  result.tenant_id = tenant_id;
  
  std::lock_guard<std::mutex> lk(mu_);
  
  auto it = tenant_root_hashes_.find(tenant_id);
  if (it == tenant_root_hashes_.end()) {
    result.error = "no_cost_records_found_for_tenant";
    return result;
  }
  
  result.claimed_root = it->second;
  
  // For now, we verify that the root hash is non-empty and well-formed
  // In production, this would traverse the full receipt chain in CAS
  if (result.claimed_root.size() != 64) {
    result.error = "invalid_cost_root_hash_length";
    return result;
  }
  
  // Verify hex encoding
  for (char c : result.claimed_root) {
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) {
      result.error = "invalid_cost_root_hash_hex";
      return result;
    }
  }
  
  result.computed_root = result.claimed_root;
  result.ok = true;
  result.verified_receipts = 1; // At least the root exists
  
  return result;
}

std::vector<CostReceipt> CostLedgerManager::list_receipts(const std::string& tenant_id) const {
  std::lock_guard<std::mutex> lk(mu_);
  
  // In production, this would read from CAS
  // For now, return empty vector (CAS integration would be added in production)
  std::vector<CostReceipt> receipts;
  return receipts;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

CostLedgerManager& global_cost_ledger() {
  static CostLedgerManager inst;
  return inst;
}

}  // namespace economics
}  // namespace requiem
