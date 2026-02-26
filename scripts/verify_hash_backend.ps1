$ErrorActionPreference = 'Stop'
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
$health = ./build/requiem_cli health
Write-Output $health
if ($health -notmatch '"hash_primitive":"blake3"') {
  throw "hash primitive is not blake3"
}
if ($health -match '"hash_backend":"fallback"' -or $health -match '"hash_backend":"unavailable"') {
  throw "hash backend is not authoritative"
}
./build/requiem_cli validate-replacement
if ($LASTEXITCODE -ne 0) { throw "validate-replacement failed" }
