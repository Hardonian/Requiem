cmake_minimum_required(VERSION 3.20)
project(requiem VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenSSL REQUIRED)

add_library(requiem
  src/hash.cpp
  src/cas.cpp
  src/runtime.cpp
  src/replay.cpp
  src/sandbox_posix.cpp
  src/sandbox_win.cpp
)

target_include_directories(requiem
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(requiem PUBLIC OpenSSL::Crypto)

target_compile_options(requiem
  PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)

add_executable(requiem_cli src/cli.cpp)
target_link_libraries(requiem_cli PRIVATE requiem)

enable_testing()

add_executable(requiem_tests
  tests/requiem_tests.cpp
)

target_link_libraries(requiem_tests
  PRIVATE
    requiem
)

add_test(NAME requiem_tests COMMAND requiem_tests)
