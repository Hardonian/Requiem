cmake_minimum_required(VERSION 3.20)
project(requiem VERSION 0.5.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(REQUIEM_WITH_LLVM_BLAKE3 "Use LLVM C BLAKE3 backend when available" ON)

find_package(OpenSSL REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(ZSTD REQUIRED libzstd)

if(REQUIEM_WITH_LLVM_BLAKE3)
  find_path(LLVM_BLAKE3_INCLUDE_DIR llvm-c/blake3.h PATHS /usr/include/llvm-c-20 /usr/include)
  find_library(LLVM_BLAKE3_LIBRARY NAMES LLVM-20.1 LLVM-20 LLVM)
endif()

add_library(requiem
  src/types.cpp
  src/hash.cpp
  src/jsonlite.cpp
  src/cas.cpp
  src/runtime.cpp
  src/replay.cpp
  src/sandbox_posix.cpp
  src/sandbox_win.cpp
)

target_include_directories(requiem
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
  PRIVATE
    ${ZSTD_INCLUDE_DIRS}
    ${LLVM_BLAKE3_INCLUDE_DIR}
)

target_link_libraries(requiem PUBLIC OpenSSL::Crypto ${ZSTD_LIBRARIES})
if(LLVM_BLAKE3_INCLUDE_DIR AND LLVM_BLAKE3_LIBRARY)
  target_compile_definitions(requiem PUBLIC REQUIEM_BLAKE3_LLVM=1)
  target_link_libraries(requiem PUBLIC ${LLVM_BLAKE3_LIBRARY})
endif()

target_compile_options(requiem
  PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)

add_executable(requiem_cli src/cli.cpp)
target_link_libraries(requiem_cli PRIVATE requiem)

enable_testing()

add_executable(requiem_tests tests/requiem_tests.cpp)
target_link_libraries(requiem_tests PRIVATE requiem)
add_test(NAME requiem_tests COMMAND requiem_tests)
