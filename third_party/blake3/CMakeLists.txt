# BLAKE3 vendored library
# Official C implementation from BLAKE3-team/BLAKE3

add_library(blake3_vendor STATIC
  blake3.c
  blake3_dispatch.c
  blake3_portable.c
)

target_include_directories(blake3_vendor
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Platform-specific optimizations
include(CheckCCompilerFlag)

if(CMAKE_C_COMPILER_ID MATCHES "GNU|Clang")
  # Enable optimizations
  target_compile_options(blake3_vendor PRIVATE
    -O3
    -Wall
    -Wextra
  )
  
  # Check for SSE2 support
  check_c_compiler_flag("-msse2" HAVE_SSE2)
  if(HAVE_SSE2)
    target_compile_options(blake3_vendor PRIVATE -msse2)
  endif()
  
  # Check for SSE4.1 support
  check_c_compiler_flag("-msse4.1" HAVE_SSE41)
  if(HAVE_SSE41)
    target_compile_options(blake3_vendor PRIVATE -msse4.1)
  endif()
  
  # Check for AVX2 support
  check_c_compiler_flag("-mavx2" HAVE_AVX2)
  if(HAVE_AVX2)
    target_compile_options(blake3_vendor PRIVATE -mavx2)
  endif()
  
  # Check for AVX-512 support
  check_c_compiler_flag("-mavx512f" HAVE_AVX512F)
  check_c_compiler_flag("-mavx512vl" HAVE_AVX512VL)
  if(HAVE_AVX512F AND HAVE_AVX512VL)
    target_compile_options(blake3_vendor PRIVATE -mavx512f -mavx512vl)
  endif()
elseif(MSVC)
  target_compile_options(blake3_vendor PRIVATE
    /O2
    /W3
  )
endif()

# Set C standard
target_compile_features(blake3_vendor PRIVATE c_std_11)
