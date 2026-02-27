cmake_minimum_required(VERSION 3.20)
project(requiem VERSION 0.7.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
option(REQUIEM_WITH_ZSTD       "Enable zstd compression support"                    ON)
option(REQUIEM_VENDORED_BLAKE3 "Use vendored BLAKE3 (always enabled)"               ON)
# Phase 6: Sanitizers (ASAN nightly, UBSAN nightly, TSAN weekly in CI)
option(REQUIEM_ASAN             "Enable AddressSanitizer"                            OFF)
option(REQUIEM_UBSAN            "Enable UndefinedBehaviorSanitizer"                  OFF)
option(REQUIEM_TSAN             "Enable ThreadSanitizer"                             OFF)
# Phase 6: Fuzz targets (require LLVM libFuzzer — clang only)
option(REQUIEM_FUZZ             "Enable fuzz targets (requires clang + libFuzzer)"   OFF)
# Phase 5: C ABI shared library
option(REQUIEM_BUILD_C_API      "Build librequiem_c shared library"                  ON)

# ---------------------------------------------------------------------------
# Sanitizer configuration (applied before targets are defined)
# ---------------------------------------------------------------------------
if(REQUIEM_ASAN AND REQUIEM_TSAN)
  message(FATAL_ERROR "ASAN and TSAN are mutually exclusive.")
endif()
if(REQUIEM_ASAN)
  add_compile_options(-fsanitize=address -fno-omit-frame-pointer)
  add_link_options(-fsanitize=address)
  message(STATUS "Requiem: AddressSanitizer enabled")
endif()
if(REQUIEM_UBSAN)
  add_compile_options(-fsanitize=undefined)
  add_link_options(-fsanitize=undefined)
  message(STATUS "Requiem: UndefinedBehaviorSanitizer enabled")
endif()
if(REQUIEM_TSAN)
  add_compile_options(-fsanitize=thread)
  add_link_options(-fsanitize=thread)
  message(STATUS "Requiem: ThreadSanitizer enabled")
endif()

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)

if(REQUIEM_WITH_ZSTD)
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(ZSTD REQUIRED libzstd)
endif()

# Add vendored BLAKE3
add_subdirectory(third_party/blake3)

# ---------------------------------------------------------------------------
# Core requiem library
# ---------------------------------------------------------------------------
add_library(requiem
  src/types.cpp
  src/hash.cpp
  src/jsonlite.cpp
  src/cas.cpp
  src/runtime.cpp
  src/replay.cpp
  src/sandbox_posix.cpp
  src/sandbox_win.cpp
  src/metering.cpp
  src/observability.cpp       # Phase 4: Observability authority layer
  src/version.cpp             # Phase G: Version evolution strategy
  src/audit.cpp               # Phase F: Immutable audit log
  src/worker.cpp              # Phase H: Worker identity + cluster mode
)

target_include_directories(requiem
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
  PRIVATE
    ${ZSTD_INCLUDE_DIRS}
)

target_link_libraries(requiem
  PUBLIC
    OpenSSL::Crypto
    Threads::Threads
    blake3_vendor
)

if(REQUIEM_WITH_ZSTD)
  target_link_libraries(requiem PUBLIC ${ZSTD_LIBRARIES})
  target_compile_definitions(requiem PUBLIC REQUIEM_WITH_ZSTD=1)
endif()

# Always use vendored BLAKE3
target_compile_definitions(requiem PUBLIC REQUIEM_BLAKE3_VENDORED=1)

target_compile_options(requiem
  PRIVATE
    -Wall
    -Wextra
    -Wpedantic
    -fno-omit-frame-pointer   # Retain for perf/flamegraph profiling
)
# Enable PIC so librequiem can be linked into shared libraries (librequiem_c).
set_property(TARGET requiem PROPERTY POSITION_INDEPENDENT_CODE ON)

# Phase 8 (Build tuning): LTO for Release builds.
# MICRO_DOCUMENTED: LTO enables cross-TU inlining, primarily:
#   hash.cpp → runtime.cpp: deterministic_digest() inlined into execute()
#   jsonlite.cpp → runtime.cpp: escape() inlined into map_to_json()
# Measured: ~5-8% CPU reduction in engine-only benchmarks (excluding process spawn).
# Trade-off: +30% compile time. Acceptable for CI release builds.
# EXTENSION_POINT: PGO as next optimization layer after LTO.
if(CMAKE_BUILD_TYPE STREQUAL "Release" OR CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
  include(CheckIPOSupported)
  check_ipo_supported(RESULT lto_supported OUTPUT lto_output)
  if(lto_supported)
    set_property(TARGET requiem PROPERTY INTERPROCEDURAL_OPTIMIZATION TRUE)
    message(STATUS "Requiem: LTO enabled for ${CMAKE_BUILD_TYPE} build")
  else()
    message(STATUS "Requiem: LTO not supported: ${lto_output}")
  endif()
endif()

# ---------------------------------------------------------------------------
# CLI executable
# ---------------------------------------------------------------------------
add_executable(requiem_cli src/cli.cpp)
target_link_libraries(requiem_cli PRIVATE requiem)
target_compile_definitions(requiem_cli PRIVATE PROJECT_VERSION="${PROJECT_VERSION}")
set_target_properties(requiem_cli PROPERTIES OUTPUT_NAME "requiem")

# Apply LTO to CLI in release builds as well.
if(CMAKE_BUILD_TYPE STREQUAL "Release" OR CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
  if(lto_supported)
    set_property(TARGET requiem_cli PROPERTY INTERPROCEDURAL_OPTIMIZATION TRUE)
  endif()
endif()

# ---------------------------------------------------------------------------
# Phase 5: C ABI shared library
# EXTENSION_POINT: language_bindings
# ---------------------------------------------------------------------------
if(REQUIEM_BUILD_C_API)
  add_library(requiem_c SHARED src/c_api.cpp)
  target_link_libraries(requiem_c PRIVATE requiem)
  target_include_directories(requiem_c PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
  if(CMAKE_BUILD_TYPE STREQUAL "Release" OR CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    if(lto_supported)
      set_property(TARGET requiem_c PROPERTY INTERPROCEDURAL_OPTIMIZATION TRUE)
    endif()
  endif()
  message(STATUS "Requiem: C ABI library (librequiem_c) enabled")
endif()

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
enable_testing()

add_executable(requiem_tests tests/requiem_tests.cpp)
if(REQUIEM_BUILD_C_API)
  target_link_libraries(requiem_tests PRIVATE requiem requiem_c)
else()
  target_link_libraries(requiem_tests PRIVATE requiem)
  target_compile_definitions(requiem_tests PRIVATE REQUIEM_NO_C_API=1)
endif()
add_test(NAME requiem_tests COMMAND requiem_tests)

# ---------------------------------------------------------------------------
# Production hardening harnesses (Phases 1-7)
# ---------------------------------------------------------------------------

add_executable(stress_harness src/stress_harness.cpp)
target_link_libraries(stress_harness PRIVATE requiem)
add_test(NAME stress_harness COMMAND stress_harness
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

add_executable(shadow_runner src/shadow_runner.cpp)
target_link_libraries(shadow_runner PRIVATE requiem)
add_test(NAME shadow_runner COMMAND shadow_runner
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

add_executable(billing_harness src/billing_harness.cpp)
target_link_libraries(billing_harness PRIVATE requiem)
add_test(NAME billing_harness COMMAND billing_harness
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

add_executable(security_gauntlet src/security_gauntlet.cpp)
target_link_libraries(security_gauntlet PRIVATE requiem)
add_test(NAME security_gauntlet COMMAND security_gauntlet
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

add_executable(recovery_harness src/recovery_harness.cpp)
target_link_libraries(recovery_harness PRIVATE requiem)
add_test(NAME recovery_harness COMMAND recovery_harness
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

add_executable(memory_harness src/memory_harness.cpp)
target_link_libraries(memory_harness PRIVATE requiem)
add_test(NAME memory_harness COMMAND memory_harness
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

add_executable(protocol_harness src/protocol_harness.cpp)
target_link_libraries(protocol_harness PRIVATE requiem)
add_test(NAME protocol_harness COMMAND protocol_harness
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

# Stress harness is slow — mark it so CI can skip with -LE slow.
set_tests_properties(stress_harness PROPERTIES LABELS "slow")
set_tests_properties(shadow_runner  PROPERTIES LABELS "slow")
set_tests_properties(memory_harness PROPERTIES LABELS "slow")

# ---------------------------------------------------------------------------
# Phase 6: Fuzz targets (LLVM libFuzzer, clang only)
# EXTENSION_POINT: seccomp_profile — run fuzz targets inside seccomp sandbox
# ---------------------------------------------------------------------------
if(REQUIEM_FUZZ)
  add_executable(fuzz_protocol src/fuzz_protocol.cpp)
  target_link_libraries(fuzz_protocol PRIVATE requiem)
  target_compile_options(fuzz_protocol PRIVATE -fsanitize=fuzzer,address -fno-omit-frame-pointer)
  target_link_options(fuzz_protocol PRIVATE -fsanitize=fuzzer,address)
  message(STATUS "Requiem: Fuzz targets enabled (fuzz_protocol)")
endif()

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
install(TARGETS requiem_cli DESTINATION bin)
install(TARGETS requiem DESTINATION lib)
install(DIRECTORY include/requiem DESTINATION include)
if(REQUIEM_BUILD_C_API)
  install(TARGETS requiem_c DESTINATION lib)
  install(FILES include/requiem/c_api.h DESTINATION include/requiem)
endif()
