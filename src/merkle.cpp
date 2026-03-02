#include "requiem/merkle.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

#include <algorithm>
#include <cmath>
#include <sstream>

namespace requiem {
namespace merkle {

// Domain separator for Merkle tree internal nodes
constexpr std::string_view kMerkleDomain = "mkl:";

// Compute hash for a Merkle tree internal node
static std::string hash_node(const std::string& left, const std::string& right) {
  // Combine left and right hashes with domain separator
  std::string combined;
  combined.reserve(left.size() + right.size() + kMerkleDomain.size());
  combined.append(kMerkleDomain.data(), kMerkleDomain.size());
  combined += left;
  combined += right;
  return blake3_hex(combined);
}

// Pad leaf hashes to the next power of 2
static std::vector<std::string> pad_to_power_of_two(const std::vector<std::string>& leaves) {
  if (leaves.empty()) {
    return {};
  }
  
  size_t n = leaves.size();
  size_t power_of_two = 1;
  while (power_of_two < n) {
    power_of_two *= 2;
  }
  
  std::vector<std::string> result = leaves;
  result.resize(power_of_two);
  
  // Pad with zero hashes (empty strings will hash to a known value)
  std::string zero_hash = blake3_hex("");
  for (size_t i = n; i < power_of_two; ++i) {
    result[i] = zero_hash;
  }
  
  return result;
}

MerkleRoot build_merkle_tree(const std::vector<std::string>& leaf_hashes) {
  MerkleRoot root;
  
  if (leaf_hashes.empty()) {
    return root;
  }
  
  // Build tree bottom-up
  std::vector<std::string> current_level = pad_to_power_of_two(leaf_hashes);
  std::vector<std::string> next_level;
  
  root.leaf_count = leaf_hashes.size();
  
  // Create leaf nodes
  for (size_t i = 0; i < current_level.size(); ++i) {
    MerkleNode node(current_level[i], true, i);
    root.tree.push_back(node);
  }
  
  // Build internal nodes
  while (current_level.size() > 1) {
    next_level.clear();
    next_level.reserve(current_level.size() / 2);
    
    for (size_t i = 0; i < current_level.size(); i += 2) {
      const std::string& left = current_level[i];
      const std::string& right = current_level[i + 1];
      
      std::string node_hash = hash_node(left, right);
      next_level.push_back(node_hash);
      
      // Store internal node
      MerkleNode internal;
      internal.hash = node_hash;
      internal.left_hash = left;
      internal.right_hash = right;
      internal.is_leaf = false;
      internal.index = i / 2;
      root.tree.push_back(internal);
    }
    
    current_level = std::move(next_level);
  }
  
  // Root hash is the last remaining element
  root.root_hash = current_level.front();
  
  return root;
}

std::string compute_merkle_root(const std::vector<std::string>& leaf_hashes) {
  if (leaf_hashes.empty()) {
    return "";
  }
  
  std::vector<std::string> current = pad_to_power_of_two(leaf_hashes);
  
  while (current.size() > 1) {
    std::vector<std::string> next;
    next.reserve(current.size() / 2);
    
    for (size_t i = 0; i < current.size(); i += 2) {
      next.push_back(hash_node(current[i], current[i + 1]));
    }
    
    current = std::move(next);
  }
  
  return current.front();
}

MerkleProof verify_merkle_proof(
    const std::string& leaf_hash,
    const std::string& root_hash,
    const std::vector<std::string>& proof_hashes,
    uint64_t leaf_index) {
  
  MerkleProof result;
  
  if (proof_hashes.empty()) {
    result.error = "Empty proof";
    return result;
  }
  
  // Start with the leaf hash
  std::string current_hash = leaf_hash;
  
  // Walk up the tree using proof hashes
  for (size_t i = 0; i < proof_hashes.size(); ++i) {
    const std::string& proof_hash = proof_hashes[i];
    bool is_right = (leaf_index >> i) & 1;
    
    if (is_right) {
      current_hash = hash_node(current_hash, proof_hash);
    } else {
      current_hash = hash_node(proof_hash, current_hash);
    }
  }
  
  result.valid = (current_hash == root_hash);
  if (!result.valid) {
    result.error = "Proof verification failed: computed hash does not match root";
  }
  
  return result;
}

MerkleRoot compute_segment_root(
    const std::vector<std::string>& event_hashes,
    uint64_t segment_start_seq) {
  
  MerkleRoot root = build_merkle_tree(event_hashes);
  root.computed_at_seq = segment_start_seq;
  
  return root;
}

// ---------------------------------------------------------------------------
// Receipt transparency tree
// ---------------------------------------------------------------------------

TransparencyTree build_receipt_tree(
    const std::string& tenant_id,
    const std::vector<std::string>& receipt_hashes) {
  
  TransparencyTree tree;
  tree.tenant_id = tenant_id;
  tree.receipt_hashes = receipt_hashes;
  tree.receipt_count = receipt_hashes.size();
  
  if (receipt_hashes.empty()) {
    return tree;
  }
  
  // Build Merkle tree from receipt hashes
  MerkleRoot merkle = build_merkle_tree(receipt_hashes);
  tree.root_hash = merkle.root_hash;
  tree.first_receipt_seq = 0;
  tree.last_receipt_seq = receipt_hashes.size() - 1;
  
  return tree;
}

bool verify_receipt_in_tree(
    const TransparencyTree& tree,
    const std::string& receipt_hash) {
  
  // Simple linear search (could be optimized with index)
  for (const auto& hash : tree.receipt_hashes) {
    if (hash == receipt_hash) {
      return true;
    }
  }
  return false;
}

std::string get_transparency_root(const TransparencyTree& tree) {
  return tree.root_hash;
}

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

std::string merkle_root_to_json(const MerkleRoot& root) {
  jsonlite::Object obj;
  obj["root_hash"] = root.root_hash;
  obj["leaf_count"] = root.leaf_count;
  obj["computed_at_seq"] = root.computed_at_seq;
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string transparency_tree_to_json(const TransparencyTree& tree) {
  jsonlite::Object obj;
  obj["tenant_id"] = tree.tenant_id;
  obj["root_hash"] = tree.root_hash;
  obj["receipt_count"] = tree.receipt_count;
  obj["first_receipt_seq"] = tree.first_receipt_seq;
  obj["last_receipt_seq"] = tree.last_receipt_seq;
  
  jsonlite::Array hashes;
  for (const auto& h : tree.receipt_hashes) {
    hashes.push_back(h);
  }
  obj["receipt_hashes"] = std::move(hashes);
  
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

MerkleRoot merkle_root_from_json(const std::string& json) {
  MerkleRoot root;
  auto obj = jsonlite::parse(json, nullptr);
  
  root.root_hash = jsonlite::get_string(obj, "root_hash", "");
  root.leaf_count = jsonlite::get_u64(obj, "leaf_count", 0);
  root.computed_at_seq = jsonlite::get_u64(obj, "computed_at_seq", 0);
  
  return root;
}

TransparencyTree transparency_tree_from_json(const std::string& json) {
  TransparencyTree tree;
  auto obj = jsonlite::parse(json, nullptr);
  
  tree.tenant_id = jsonlite::get_string(obj, "tenant_id", "");
  tree.root_hash = jsonlite::get_string(obj, "root_hash", "");
  tree.receipt_count = jsonlite::get_u64(obj, "receipt_count", 0);
  tree.first_receipt_seq = jsonlite::get_u64(obj, "first_receipt_seq", 0);
  tree.last_receipt_seq = jsonlite::get_u64(obj, "last_receipt_seq", 0);
  
  auto hashes_arr = jsonlite::get_string_array(obj, "receipt_hashes");
  for (const auto& h : hashes_arr) {
    tree.receipt_hashes.push_back(h);
  }
  
  return tree;
}

}  // namespace merkle
}  // namespace requiem
