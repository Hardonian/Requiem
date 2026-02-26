#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#include "blake3.h"
#include "blake3_impl.h"

const char *blake3_version(void) { return BLAKE3_VERSION_STRING; }

INLINE void chunk_state_init(blake3_chunk_state *self, const uint32_t key[8],
                             uint8_t flags) {
  memcpy(self->cv, key, BLAKE3_KEY_LEN);
  self->chunk_counter = 0;
  memset(self->buf, 0, BLAKE3_BLOCK_LEN);
  self->buf_len = 0;
  self->blocks_compressed = 0;
  self->flags = flags;
}

INLINE void chunk_state_reset(blake3_chunk_state *self, const uint32_t key[8],
                              uint64_t chunk_counter) {
  memcpy(self->cv, key, BLAKE3_KEY_LEN);
  self->chunk_counter = chunk_counter;
  self->blocks_compressed = 0;
  memset(self->buf, 0, BLAKE3_BLOCK_LEN);
  self->buf_len = 0;
}

INLINE size_t chunk_state_len(const blake3_chunk_state *self) {
  return (BLAKE3_BLOCK_LEN * (size_t)self->blocks_compressed) +
         ((size_t)self->buf_len);
}

INLINE size_t chunk_state_fill_buf(blake3_chunk_state *self,
                                   const uint8_t *input, size_t input_len) {
  size_t take = BLAKE3_BLOCK_LEN - ((size_t)self->buf_len);
  if (take > input_len) {
    take = input_len;
  }
  uint8_t *dest = self->buf + ((size_t)self->buf_len);
  memcpy(dest, input, take);
  self->buf_len += (uint8_t)take;
  return take;
}

INLINE uint8_t chunk_state_maybe_start_flag(const blake3_chunk_state *self) {
  if (self->blocks_compressed == 0) {
    return CHUNK_START;
  } else {
    return 0;
  }
}

typedef struct {
  uint32_t input_cv[8];
  uint64_t counter;
  uint8_t block[BLAKE3_BLOCK_LEN];
  uint8_t block_len;
  uint8_t flags;
} output_t;

INLINE output_t make_output(const uint32_t input_cv[8],
                            const uint8_t block[BLAKE3_BLOCK_LEN],
                            uint8_t block_len, uint64_t counter,
                            uint8_t flags) {
  output_t ret;
  memcpy(ret.input_cv, input_cv, 32);
  memcpy(ret.block, block, BLAKE3_BLOCK_LEN);
  ret.block_len = block_len;
  ret.counter = counter;
  ret.flags = flags;
  return ret;
}

// Chaining values within a given chunk (specifically the compress_in_place
// interface) are represented as words. This avoids unnecessary bytes<->words
// conversion overhead in the portable implementation. However, the hash_many
// interface handles both user input and parent node blocks, so it accepts
// bytes. For that reason, chaining values in the CV stack are represented as
// bytes.
INLINE void output_chaining_value(const output_t *self, uint8_t cv[32]) {
  uint32_t cv_words[8];
  memcpy(cv_words, self->input_cv, 32);
  blake3_compress_in_place(cv_words, self->block, self->block_len,
                           self->counter, self->flags);
  store_cv_words(cv, cv_words);
}

INLINE void output_root_bytes(const output_t *self, uint64_t seek, uint8_t *out,
                              size_t out_len) {
  if (out_len == 0) {
    return;
  }
  uint64_t output_block_counter = seek / 64;
  size_t offset_within_block = seek % 64;
  uint8_t wide_buf[64];
  if(offset_within_block) {
    blake3_compress_xof(self->input_cv, self->block, self->block_len, output_block_counter, self->flags | ROOT, wide_buf);
    const size_t available_bytes = 64 - offset_within_block;
    const size_t bytes = out_len > available_bytes ? available_bytes : out_len;
    memcpy(out, wide_buf + offset_within_block, bytes);
    out += bytes;
    out_len -= bytes;
    output_block_counter += 1;
  }
  if(out_len / 64) {
    blake3_xof_many(self->input_cv, self->block, self->block_len, output_block_counter, self->flags | ROOT, out, out_len / 64);
  }
  output_block_counter += out_len / 64;
  out += out_len & -64;
  out_len -= out_len & -64;
  if(out_len) {
    blake3_compress_xof(self->input_cv, self->block, self->block_len, output_block_counter, self->flags | ROOT, wide_buf);
    memcpy(out, wide_buf, out_len);
  }
}

INLINE void chunk_state_update(blake3_chunk_state *self, const uint8_t *input,
                               size_t input_len) {
  if (self->buf_len > 0) {
    size_t take = chunk_state_fill_buf(self, input, input_len);
    input += take;
    input_len -= take;
    if (input_len > 0) {
      blake3_compress_in_place(
          self->cv, self->buf, BLAKE3_BLOCK_LEN, self->chunk_counter,
          self->flags | chunk_state_maybe_start_flag(self));
      self->blocks_compressed += 1;
      self->buf_len = 0;
      memset(self->buf, 0, BLAKE3_BLOCK_LEN);
    }
  }

  while (input_len > BLAKE3_BLOCK_LEN) {
    blake3_compress_in_place(self->cv, input, BLAKE3_BLOCK_LEN,
                             self->chunk_counter,
                             self->flags | chunk_state_maybe_start_flag(self));
    self->blocks_compressed += 1;
    input += BLAKE3_BLOCK_LEN;
    input_len -= BLAKE3_BLOCK_LEN;
  }

  chunk_state_fill_buf(self, input, input_len);
}

INLINE output_t chunk_state_output(const blake3_chunk_state *self) {
  uint8_t block_flags =
      self->flags | chunk_state_maybe_start_flag(self) | CHUNK_END;
  return make_output(self->cv, self->buf, self->buf_len, self->chunk_counter,
                     block_flags);
}

INLINE output_t parent_output(const uint8_t block[BLAKE3_BLOCK_LEN],
                              const uint32_t key[8], uint8_t flags) {
  return make_output(key, block, BLAKE3_BLOCK_LEN, 0, flags | PARENT);
}

// Given some input larger than one chunk, return the number of bytes that
// should go in the left subtree. This is the largest power-of-2 number of
// chunks that leaves at least 1 byte for the right subtree.
INLINE size_t left_subtree_len(size_t input_len) {
  // Subtract 1 to reserve at least one byte for the right side. input_len
  // should always be greater than BLAKE3_CHUNK_LEN.
  size_t full_chunks = (input_len - 1) / BLAKE3_CHUNK_LEN;
  return round_down_to_power_of_2(full_chunks) * BLAKE3_CHUNK_LEN;
}

// Use SIMD parallelism to hash up to MAX_SIMD_DEGREE chunks at the same time
// on a single thread. Write out the chunk chaining values and return the
// number of chunks hashed. These chunks are never the root and never empty;
// those cases use a different codepath.
INLINE size_t compress_chunks_parallel(const uint8_t *input, size_t input_len,
                                       const uint32_t key[8],
                                       uint64_t chunk_counter, uint8_t flags,
                                       uint8_t *out) {
#if defined(BLAKE3_TESTING)
  assert(0 < input_len);
  assert(input_len <= MAX_SIMD_DEGREE * BLAKE3_CHUNK_LEN);
#endif

  const uint8_t *chunks_array[MAX_SIMD_DEGREE];
  size_t input_position = 0;
  size_t chunks_array_len = 0;
  while (input_len - input_position >= BLAKE3_CHUNK_LEN) {
    chunks_array[chunks_array_len] = &input[input_position];
    input_position += BLAKE3_CHUNK_LEN;
    chunks_array_len += 1;
  }

  blake3_hash_many(chunks_array, chunks_array_len,
                   BLAKE3_CHUNK_LEN / BLAKE3_BLOCK_LEN, key, chunk_counter,
                   true, flags, CHUNK_START, CHUNK_END, out);

  // Hash the remaining partial chunk, if there is one. Note that the empty
  // chunk (meaning the empty message) is a different codepath.
  if (input_len > input_position) {
    uint64_t counter = chunk_counter + (uint64_t)chunks_array_len;
    blake3_chunk_state chunk_state;
    chunk_state_init(&chunk_state, key, flags);
    chunk_state.chunk_counter = counter;
    chunk_state_update(&chunk_state, &input[input_position],
                       input_len - input_position);
    output_t output = chunk_state_output(&chunk_state);
    output_chaining_value(&output, &out[chunks_array_len * BLAKE3_OUT_LEN]);
    return chunks_array_len + 1;
  } else {
    return chunks_array_len;
  }
}

// Use SIMD parallelism to hash up to MAX_SIMD_DEGREE parents at the same time
// on a single thread. Write out the parent chaining values and return the
// number of parents hashed. (If there's an odd input chaining value left over,
// return it as an additional output.) These parents are never the root and
// never empty; those cases use a different codepath.
INLINE size_t compress_parents_parallel(const uint8_t *child_chaining_values,
                                        size_t num_chaining_values,
                                        const uint32_t key[8], uint8_t flags,
                                        uint8_t *out) {
#if defined(BLAKE3_TESTING)
  assert(2 <= num_chaining_values);
  assert(num_chaining_values <= 2 * MAX_SIMD_DEGREE);
#endif
  const uint8_t *parent_block_ptrs[MAX_SIMD_DEGREE];
  size_t parent_block_ptrs_len = 0;
  while (num_chaining_values - (2 * parent_block_ptrs_len) >= 2) {
    parent_block_ptrs[parent_block_ptrs_len] =
        &child_chaining_values[2 * parent_block_ptrs_len * BLAKE3_OUT_LEN];
    parent_block_ptrs_len += 1;
  }
  blake3_hash_many(parent_block_ptrs, parent_block_ptrs_len, 1, key,
                   0,  // Parents always use counter 0
                   false, flags, PARENT, PARENT, out);
  // If there's an odd child chaining value left over, it becomes an output.
  if (num_chaining_values % 2 == 1) {
    memcpy(&out[parent_block_ptrs_len * BLAKE3_OUT_LEN],
           &child_chaining_values[(num_chaining_values - 1) * BLAKE3_OUT_LEN],
           BLAKE3_OUT_LEN);
    return parent_block_ptrs_len + 1;
  } else {
    return parent_block_ptrs_len;
  }
}

// The wide helper function returns (writes out) chaining values for each
// chunk and each SIMD degree parent grouping. It doesn't do any merging, so
// there might be more outputs than expected. The number of outputs is always
// less than or equal to the number of chunks, i.e., ceil(input_len / 1024).
INLINE void compress_subtree_to_parent_node(
    const uint8_t *input, size_t input_len, const uint32_t key[8],
    uint64_t chunk_counter, uint8_t flags, uint8_t *out, size_t *out_n) {
#if defined(BLAKE3_TESTING)
  assert(input_len > BLAKE3_CHUNK_LEN);
#endif
  size_t max_output_n = (input_len + BLAKE3_CHUNK_LEN - 1) / BLAKE3_CHUNK_LEN;

  uint8_t cv[MAX_SIMD_DEGREE_OR_2 * BLAKE3_OUT_LEN / 2];
  size_t num_cvs = 0;
  while (input_len > 0) {
    size_t subtree_len = input_len;
    if (subtree_len > (MAX_SIMD_DEGREE_OR_2 * BLAKE3_CHUNK_LEN)) {
      subtree_len = MAX_SIMD_DEGREE_OR_2 * BLAKE3_CHUNK_LEN;
    }
    size_t chunk_n = compress_chunks_parallel(input, subtree_len, key,
                                              chunk_counter, flags, cv);
    chunk_counter += (uint64_t)chunk_n;
    size_t parent_n = chunk_n;
    // The second condition here is the "wide root" special case, where we have
    // a parent node but it's too wide to finalize.
    while (parent_n > 2 && parent_n <= MAX_SIMD_DEGREE_OR_2) {
      parent_n = compress_parents_parallel(cv, parent_n, key, flags, cv);
    }
    memcpy(&out[num_cvs * BLAKE3_OUT_LEN], cv, parent_n * BLAKE3_OUT_LEN);
    num_cvs += parent_n;
    input += subtree_len;
    input_len -= subtree_len;
  }
#if defined(BLAKE3_TESTING)
  assert(num_cvs <= max_output_n);
  (void)max_output_n;
#endif
  *out_n = num_cvs;
}

// Hash a subtree with explicit SIMD parallelism. The `out` pointer must point
// to at least 32 bytes. The number of output chaining values is returned.
// `use_tbb` enables Intel Threading Building Blocks for additional
// parallelism.
BLAKE3_PRIVATE size_t blake3_compress_subtree_wide(const uint8_t *input,
                                                   size_t input_len,
                                                   const uint32_t key[8],
                                                   uint64_t chunk_counter,
                                                   uint8_t flags, uint8_t *out,
                                                   bool use_tbb) {
#if defined(BLAKE3_USE_TBB)
  if (use_tbb) {
    size_t mid = left_subtree_len(input_len);
    size_t left_n, right_n;
    blake3_compress_subtree_wide_join_tbb(
        key, flags, true, input, mid, chunk_counter, out, &left_n,
        input + mid, input_len - mid, chunk_counter + (mid / BLAKE3_CHUNK_LEN),
        out + left_n * BLAKE3_OUT_LEN, &right_n);
    return left_n + right_n;
  }
#else
  (void)use_tbb;
#endif
  return blake3_simd_degree();
}

// Hash a subtree with explicit platform parallelism. The `out` pointer must
// point to at least 32 bytes.
INLINE void compress_subtree_wide(const uint8_t *input, size_t input_len,
                                  const uint32_t key[8],
                                  uint64_t chunk_counter, uint8_t flags,
                                  uint8_t out[BLAKE3_OUT_LEN]) {
  // The compress_subtree_wide function assumes it's hashing more than one
  // chunk. Use the platform-independent compress_subtree_to_parent_node for
  // the rest.
#if defined(BLAKE3_TESTING)
  assert(input_len > BLAKE3_CHUNK_LEN);
#endif
  uint8_t cv[MAX_SIMD_DEGREE_OR_2 * BLAKE3_OUT_LEN / 2];
  size_t num_cvs = 0;
  blake3_compress_subtree_to_parent_node(input, input_len, key, chunk_counter,
                                         flags, cv, &num_cvs);
  assert(num_cvs > 1);
  // If MAX_SIMD_DEGREE is greater than 1, then:
  // - The subtree fits in MAX_SIMD_DEGREE_OR_2 chunks.
  // - We did a "wide" compression at the end of
  //   compress_subtree_to_parent_node.
  // - There are at most MAX_SIMD_DEGREE_OR_2 parent CVs.
  // - The final CV is always the root output.
  // - The second-to-last CV is a parent.
  // - Parent nodes are never root.
  // - The number of outputs is always at least 2.
  // - Thus, the last two outputs are always a parent and then the root, and
  //   we merge them with parent CV merging.
  //
  // If MAX_SIMD_DEGREE is 1, then:
  // - The subtree doesn't fit in MAX_SIMD_DEGREE_OR_2 chunks (because that
  //   equals 2).
  // - Thus compress_subtree_to_parent_node will never do a "wide"
  //   compression.
  // - Thus the number of outputs is equal to the number of chunks.
  // - Chunks are never root.
  // - The number of outputs is always greater than 1.
  // - Thus, the last output is always the root, and the output before that
  //   is a parent.
  // - Thus we merge them with parent CV merging.
  //
  // In both cases, there are at least 2 outputs. At least one of the
  // non-root outputs might be a parent, but we don't need to worry about
  // that because parent CV merging is associative.
  size_t total_parents = num_cvs - 1;
  while (total_parents > 1) {
#if defined(BLAKE3_TESTING)
    assert(num_cvs <= MAX_SIMD_DEGREE_OR_2);
#endif
    num_cvs = compress_parents_parallel(cv, num_cvs, key, flags, cv);
    total_parents = num_cvs - 1;
  }
  assert(num_cvs == 2);
  // Root is always the last output.
  output_t root_output = parent_output(cv, key, flags);
  output_chaining_value(&root_output, out);
}

INLINE void hasher_init_base(blake3_hasher *self, const uint32_t key[8],
                             uint8_t flags) {
  memcpy(self->key, key, BLAKE3_KEY_LEN);
  chunk_state_init(&self->chunk, key, flags);
  self->cv_stack_len = 0;
}

void blake3_hasher_init(blake3_hasher *self) {
  hasher_init_base(self, IV, 0);
}

void blake3_hasher_init_keyed(blake3_hasher *self,
                              const uint8_t key[BLAKE3_KEY_LEN]) {
  uint32_t key_words[8];
  load_key_words(key, key_words);
  hasher_init_base(self, key_words, KEYED_HASH);
}

void blake3_hasher_init_derive_key_raw(blake3_hasher *self, const void *context,
                                       size_t context_len) {
  blake3_hasher context_hasher;
  hasher_init_base(&context_hasher, IV, DERIVE_KEY_CONTEXT);
  blake3_hasher_update(&context_hasher, context, context_len);
  uint8_t context_key[BLAKE3_KEY_LEN];
  blake3_hasher_finalize(&context_hasher, context_key, BLAKE3_KEY_LEN);
  uint32_t context_key_words[8];
  load_key_words(context_key, context_key_words);
  hasher_init_base(self, context_key_words, DERIVE_KEY_MATERIAL);
}

void blake3_hasher_init_derive_key(blake3_hasher *self, const char *context) {
  blake3_hasher_init_derive_key_raw(self, context, strlen(context));
}

// Increment the counter for the current chunk.
INLINE void hasher_increment_counter(blake3_hasher *self) {
  self->chunk.chunk_counter += 1;
}

// Given some new input bytes that we know will create a complete chunk,
// combine them with any buffered input and hash them. Do not finalize the
// chunk (i.e. don't set CHUNK_END). Store the resulting chaining value in
// the CV stack.
INLINE void hasher_push_chunk_cv(blake3_hasher *self,
                                 const uint8_t chunk_cv[BLAKE3_OUT_LEN],
                                 uint8_t *block, uint8_t block_len) {
  assert(block_len > 0);
  assert(block_len <= BLAKE3_BLOCK_LEN);
  // Increment the counter to keep track of how many chunks we've hashed.
  hasher_increment_counter(self);
  // Compute the parent node for this chunk and the previous chunk(s) if
  // any. This loop merges adjacent chunks together, maintaining the
  // following invariant:
  // - The CV stack always represents a left-heavy binary tree.
  // - The number of trailing 1s in the total number of chunks hashed so
  //   far equals the number of CVs in the stack.
  // - The total number of chunks hashed so far equals
  //   1 << (cv_stack_len - 1).
  // - CVs are stored in the stack from low to high, so the lowest CV is
  //   at the front of the stack.
  size_t post_merge_stack_len = self->cv_stack_len;
  while ((post_merge_stack_len & 1) == 1) {
    size_t parent_block_offset = (post_merge_stack_len - 1) * BLAKE3_OUT_LEN;
    // Make a new parent block by concatenating the previous CV with the
    // new chunk CV.
    uint8_t parent_block[BLAKE3_BLOCK_LEN];
    memcpy(parent_block, &self->cv_stack[parent_block_offset], BLAKE3_OUT_LEN);
    memcpy(&parent_block[BLAKE3_OUT_LEN], chunk_cv, BLAKE3_OUT_LEN);
    // Hash the parent block.
    output_t parent_output = parent_output(parent_block, self->key,
                                           self->chunk.flags);
    output_chaining_value(&parent_output, &self->cv_stack[parent_block_offset]);
    post_merge_stack_len -= 1;
  }
  // If the stack is now empty, store the new chunk CV. Otherwise, add the
  // new chunk CV to the front of the stack. Note that merging might have
  // freed up a slot.
  memcpy(&self->cv_stack[post_merge_stack_len * BLAKE3_OUT_LEN], chunk_cv,
         BLAKE3_OUT_LEN);
  post_merge_stack_len += 1;
  self->cv_stack_len = (uint8_t)post_merge_stack_len;
}

// Given the bytes in the current chunk (possibly empty), hash them and add
// the resulting chaining value to the CV stack. Then increment the counter.
INLINE void hasher_chunk_finalize(blake3_hasher *self, uint8_t *block,
                                  uint8_t block_len) {
  assert(block_len > 0);
  assert(block_len <= BLAKE3_BLOCK_LEN);
  output_t chunk_output = chunk_state_output(&self->chunk);
  uint8_t chunk_cv[BLAKE3_OUT_LEN];
  output_chaining_value(&chunk_output, chunk_cv);
  hasher_push_chunk_cv(self, chunk_cv, block, block_len);
  // Reset the chunk state for the next chunk.
  chunk_state_reset(&self->chunk, self->key, self->chunk.chunk_counter);
}

void blake3_hasher_update(blake3_hasher *self, const void *input,
                          size_t input_len) {
  const uint8_t *input_bytes = (const uint8_t *)input;

  // If we already have a partial chunk in the buffer, we need to fill
  // that first.
  if (self->chunk.buf_len > 0) {
    size_t take = BLAKE3_CHUNK_LEN - ((size_t)self->chunk.buf_len);
    if (take > input_len) {
      take = input_len;
    }
    chunk_state_update(&self->chunk, input_bytes, take);
    input_bytes += take;
    input_len -= take;
    if (input_len > 0) {
      // We've filled the buffer, so now we can hash it.
      hasher_chunk_finalize(self, self->chunk.buf, self->chunk.buf_len);
    } else {
      // We've consumed all the input.
      return;
    }
  }

  // Hash as many whole chunks as we can.
  while (input_len > BLAKE3_CHUNK_LEN) {
    size_t subtree_len = round_down_to_power_of_2(input_len);
    uint64_t count_so_far = self->chunk.chunk_counter;
    // Shrink the subtree_len until it's evenly divided by the chunk size,
    // and also until it's no more than MAX_SIMD_DEGREE_OR_2 chunks.
    while (((subtree_len - 1) & subtree_len) != 0 ||
           subtree_len / BLAKE3_CHUNK_LEN > MAX_SIMD_DEGREE_OR_2) {
      subtree_len /= 2;
    }
    uint64_t subtree_chunks = (uint64_t)(subtree_len / BLAKE3_CHUNK_LEN);
    if (subtree_len <= BLAKE3_CHUNK_LEN) {
      chunk_state_update(&self->chunk, input_bytes, subtree_len);
      hasher_chunk_finalize(self, self->chunk.buf, self->chunk.buf_len);
    } else {
      // The subtree is more than one chunk, so hash it using
      // compress_subtree_wide.
      compress_subtree_wide(input_bytes, subtree_len, self->key,
                            count_so_far, self->chunk.flags, self->cv_stack);
      self->cv_stack_len = 1;
      // Update the chunk counter and input pointer.
      self->chunk.chunk_counter += subtree_chunks;
    }
    input_bytes += subtree_len;
    input_len -= subtree_len;
  }

  // If there's any remaining input less than a full chunk, buffer it.
  if (input_len > 0) {
    chunk_state_update(&self->chunk, input_bytes, input_len);
  }
}

void blake3_hasher_finalize(const blake3_hasher *self, uint8_t *out,
                            size_t out_len) {
  // If the subtree is a single chunk, finalize that chunk without
  // making a parent node.
  if (self->cv_stack_len == 0) {
    output_t output = chunk_state_output(&self->chunk);
    output_root_bytes(&output, 0, out, out_len);
    return;
  }
  // Otherwise, we need to make parent nodes to represent the subtree
  // roots. Start with the rightmost child.
  output_t output = chunk_state_output(&self->chunk);
  // The rightmost child is always a chunk, and we need to merge it with
  // all the parent nodes in the CV stack, from right to left.
  size_t parent_block_offset = ((size_t)self->cv_stack_len - 1) * BLAKE3_OUT_LEN;
  while (parent_block_offset > 0) {
    // Make a new parent block by concatenating the previous CV with the
    // new chunk CV.
    uint8_t parent_block[BLAKE3_BLOCK_LEN];
    memcpy(parent_block, &self->cv_stack[parent_block_offset], BLAKE3_OUT_LEN);
    output_chaining_value(&output, &parent_block[BLAKE3_OUT_LEN]);
    // Hash the parent block.
    output = parent_output(parent_block, self->key, self->chunk.flags);
    parent_block_offset -= BLAKE3_OUT_LEN;
  }
  // The root output is the hash of the concatenation of the first CV in
  // the stack and the output of the rightmost child.
  uint8_t parent_block[BLAKE3_BLOCK_LEN];
  memcpy(parent_block, self->cv_stack, BLAKE3_OUT_LEN);
  output_chaining_value(&output, &parent_block[BLAKE3_OUT_LEN]);
  output_root_bytes(&parent_output(parent_block, self->key,
                                   self->chunk.flags | ROOT),
                    0, out, out_len);
}

void blake3_hasher_finalize_seek(const blake3_hasher *self, uint64_t seek,
                                 uint8_t *out, size_t out_len) {
  // If the subtree is a single chunk, finalize that chunk without
  // making a parent node.
  if (self->cv_stack_len == 0) {
    output_t output = chunk_state_output(&self->chunk);
    output_root_bytes(&output, seek, out, out_len);
    return;
  }
  // Otherwise, we need to make parent nodes to represent the subtree
  // roots. Start with the rightmost child.
  output_t output = chunk_state_output(&self->chunk);
  // The rightmost child is always a chunk, and we need to merge it with
  // all the parent nodes in the CV stack, from right to left.
  size_t parent_block_offset = ((size_t)self->cv_stack_len - 1) * BLAKE3_OUT_LEN;
  while (parent_block_offset > 0) {
    // Make a new parent block by concatenating the previous CV with the
    // new chunk CV.
    uint8_t parent_block[BLAKE3_BLOCK_LEN];
    memcpy(parent_block, &self->cv_stack[parent_block_offset], BLAKE3_OUT_LEN);
    output_chaining_value(&output, &parent_block[BLAKE3_OUT_LEN]);
    // Hash the parent block.
    output = parent_output(parent_block, self->key, self->chunk.flags);
    parent_block_offset -= BLAKE3_OUT_LEN;
  }
  // The root output is the hash of the concatenation of the first CV in
  // the stack and the output of the rightmost child.
  uint8_t parent_block[BLAKE3_BLOCK_LEN];
  memcpy(parent_block, self->cv_stack, BLAKE3_OUT_LEN);
  output_chaining_value(&output, &parent_block[BLAKE3_OUT_LEN]);
  output_root_bytes(&parent_output(parent_block, self->key,
                                   self->chunk.flags | ROOT),
                    seek, out, out_len);
}

void blake3_hasher_reset(blake3_hasher *self) {
  chunk_state_reset(&self->chunk, self->key, 0);
  self->cv_stack_len = 0;
}
