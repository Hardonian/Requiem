cmake_minimum_required(VERSION 3.20)
project(requiem VERSION 0.7.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Options
option(REQUIEM_WITH_ZSTD "Enable zstd compression support" ON)
option(REQUIEM_VENDORED_BLAKE3 "Use vendored BLAKE3 (always enabled)" ON)

# Find required packages
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)

if(REQUIEM_WITH_ZSTD)
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(ZSTD REQUIRED libzstd)
endif()

# Add vendored BLAKE3
add_subdirectory(third_party/blake3)

# Core requiem library
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
)

# CLI executable
add_executable(requiem_cli src/cli.cpp)
target_link_libraries(requiem_cli PRIVATE requiem)
target_compile_definitions(requiem_cli PRIVATE PROJECT_VERSION="${PROJECT_VERSION}")
set_target_properties(requiem_cli PROPERTIES OUTPUT_NAME "requiem")

# Tests
enable_testing()

add_executable(requiem_tests tests/requiem_tests.cpp)
target_link_libraries(requiem_tests PRIVATE requiem)
add_test(NAME requiem_tests COMMAND requiem_tests)

# Production hardening harnesses (Phases 1-7)
# These produce artifacts/reports/*.json and exit 0 on pass.

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

# Install
install(TARGETS requiem_cli DESTINATION bin)
install(TARGETS requiem DESTINATION lib)
install(DIRECTORY include/requiem DESTINATION include)
