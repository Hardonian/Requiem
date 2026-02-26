cmake_minimum_required(VERSION 3.20)
project(requiem VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(requiem
  src/hash.cpp
  src/cas.cpp
  src/runtime.cpp
  src/replay.cpp
)

target_include_directories(requiem
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_options(requiem
  PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)

enable_testing()

add_executable(requiem_tests
  tests/requiem_tests.cpp
)

target_link_libraries(requiem_tests
  PRIVATE
    requiem
)

add_test(NAME requiem_tests COMMAND requiem_tests)
