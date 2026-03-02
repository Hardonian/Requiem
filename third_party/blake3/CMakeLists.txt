# BLAKE3 vendored library
# Official C implementation from BLAKE3-team/BLAKE3
# Using portable-only mode since SIMD intrinsics source files are not vendored.

add_library(blake3_vendor STATIC
  blake3.c
  blake3_dispatch.c
  blake3_portable.c
)

target_include_directories(blake3_vendor
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Compile in portable-only mode: SIMD intrinsics source files (blake3_sse2.c,
# blake3_sse41.c, blake3_avx2.c, blake3_avx512.c) are not vendored, so we
# disable the dispatch paths that reference them.
target_compile_definitions(blake3_vendor PRIVATE
  BLAKE3_NO_SSE2
  BLAKE3_NO_SSE41
  BLAKE3_NO_AVX2
  BLAKE3_NO_AVX512
)

if(CMAKE_C_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(blake3_vendor PRIVATE -O3 -w)
elseif(MSVC)
  # Strip /RTC1 (runtime checks) and /Od (debug opt-disable) inherited from
  # CMAKE_C_FLAGS_DEBUG — they conflict with /O2 which blake3 needs.
  # We override at the source level using COMPILE_FLAGS on the target.
  set_target_properties(blake3_vendor PROPERTIES
    COMPILE_FLAGS "/O2 /W0 /GS-"
  )
  # Remove inherited debug optimisation/RTC flags for this static lib.
  string(REPLACE "/RTC1" "" CMAKE_C_FLAGS_DEBUG_BLAKE3 "${CMAKE_C_FLAGS_DEBUG}")
  string(REPLACE "/Od"   "" CMAKE_C_FLAGS_DEBUG_BLAKE3 "${CMAKE_C_FLAGS_DEBUG_BLAKE3}")
  set_property(TARGET blake3_vendor PROPERTY
    COMPILE_OPTIONS ""  # clear, rely on COMPILE_FLAGS above
  )
endif()

# Set C standard
target_compile_features(blake3_vendor PRIVATE c_std_11)
