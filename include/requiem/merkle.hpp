#pragma once

// requiem/merkle.hpp — Merkle tree utilities for event log and receipt transparency.
//
// PHASE 2: Structural Moat Upgrade - Merkleized Event Log
//
// Provides:
//   - Binary Merkle tree construction from event hashes
//   - Segment-level Merkle root computation for partial verification
//   - Receipt transparency tree for aggregate receipt verification

#include <string>
#include <vector>
#include <cstdint>

namespace requiem {
namespace merkle {

// ---------------------------------------------------------------------------
// Merkle tree node
// ---------------------------------------------------------------------------

struct MerkleNode {
  std::string hash;           // BLAKE3 hash of this node
  std::string left_hash;      // Left child hash (empty for leaf)
  std::string right_hash;     // Right child hash (empty for leaf)
  bool is_leaf{false};
  uint64_t index{0};          // Index in the leaf array
  
  MerkleNode() = default;
  MerkleNode(const std::string& h, bool leaf, uint64_t idx)
      : hash(h), is_leaf(leaf), index(idx) {}
};

// ---------------------------------------------------------------------------
// Merkle root result
// ---------------------------------------------------------------------------

struct MerkleRoot {
  std::string root_hash;           // Root of the Merkle tree
  uint64_t leaf_count{0};          // Number of leaves in the tree
  std::vector<MerkleNode> tree;    // Full tree nodes (for verification)
  uint64_t computed_at_seq{0};     // Event sequence number when computed
  
  bool empty() const { return root_hash.empty(); }
};

// ---------------------------------------------------------------------------
// Merkle tree construction
// ---------------------------------------------------------------------------

// Build a Merkle tree from a list of leaf hashes.
// Uses BLAKE3 for internal node hashing with domain tag "mkl:".
// Tree is binary and complete (pad with zero hashes if needed).
MerkleRoot build_merkle_tree(const std::vector<std::string>& leaf_hashes);

// Compute just the root hash without building full tree (more efficient for large n).
// Uses recursive hash computation with the same algorithm as build_merkle_tree.
std::string compute_merkle_root(const std::vector<std::string>& leaf_hashes);

// Verify a leaf hash against the Merkle root and a proof path.
// proof_hashes should contain sibling hashes from leaf to root.
struct MerkleProof {
  bool valid{false};
  std::string error;
};

MerkleProof verify_merkle_proof(
    const std::string& leaf_hash,
    const std::string& root_hash,
    const std::vector<std::string>& proof_hashes,
    uint64_t leaf_index);

// ---------------------------------------------------------------------------
// Segment Merkle root for event log
// ---------------------------------------------------------------------------

// Event log segment configuration
constexpr size_t kDefaultSegmentSize = 1024;  // Events per segment

// Compute segment Merkle root from event hashes in a range.
// This enables O(log n) partial verification of event log segments.
MerkleRoot compute_segment_root(
    const std::vector<std::string>& event_hashes,
    uint64_t segment_start_seq);

// ---------------------------------------------------------------------------
// Receipt transparency tree
// ---------------------------------------------------------------------------

// Receipt transparency tree aggregates receipts for a tenant.
// Root is anchored in the event log at configurable intervals.
struct TransparencyTree {
  std::string tenant_id;
  std::string root_hash;
  uint64_t receipt_count{0};
  uint64_t first_receipt_seq{0};
  uint64_t last_receipt_seq{0};
  std::vector<std::string> receipt_hashes;  // All receipt hashes in tree
};

// Build a receipt transparency tree for a tenant's receipts.
TransparencyTree build_receipt_tree(
    const std::string& tenant_id,
    const std::vector<std::string>& receipt_hashes);

// Verify a specific receipt exists in the transparency tree.
bool verify_receipt_in_tree(
    const TransparencyTree& tree,
    const std::string& receipt_hash);

// Get the transparency root for a tenant (for external verification).
std::string get_transparency_root(const TransparencyTree& tree);

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

std::string merkle_root_to_json(const MerkleRoot& root);
std::string transparency_tree_to_json(const TransparencyTree& tree);

MerkleRoot merkle_root_from_json(const std::string& json);
TransparencyTree transparency_tree_from_json(const std::string& json);

}  // namespace merkle
}  // namespace requiem
