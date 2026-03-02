#!/usr/bin/env pwsh
# build.ps1 — Configure and build Requiem with vcpkg
# Usage: .\build.ps1 [Debug|Release]
#
# Requires:
#   - CMake 4+ in PATH
#   - Visual Studio 2022 Build Tools (MSVC)
#   - vcpkg bootstrapped at ~/vcpkg with openssl:x64-windows + zstd:x64-windows

param(
  [ValidateSet("Debug","Release","RelWithDebInfo")]
  [string]$BuildType = "Debug"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root       = $PSScriptRoot
$BuildDir   = "$Root\build"
$VcpkgRoot  = "$env:USERPROFILE\vcpkg"
$VcpkgFile  = "$VcpkgRoot\scripts\buildsystems\vcpkg.cmake"

if (-not (Test-Path $VcpkgFile)) {
  Write-Error "vcpkg not found at $VcpkgRoot. Run: git clone https://github.com/microsoft/vcpkg ~/vcpkg && ~/vcpkg/bootstrap-vcpkg.bat -disableMetrics"
  exit 1
}

Write-Host "`nConfiguring ($BuildType)..." -ForegroundColor Cyan

cmake -S $Root -B $BuildDir `
  "-DCMAKE_BUILD_TYPE=$BuildType" `
  "-DCMAKE_TOOLCHAIN_FILE=$VcpkgFile" `
  "-DVCPKG_TARGET_TRIPLET=x64-windows" `
  "-DREQUIEM_WITH_ZSTD=ON" `
  "-DREQUIEM_BUILD_C_API=OFF" 2>&1

if ($LASTEXITCODE -ne 0) { Write-Error "CMake configure failed"; exit 1 }

Write-Host "`nBuilding..." -ForegroundColor Cyan
cmake --build $BuildDir --config $BuildType -j 2>&1

if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

Write-Host "`nBuild complete. Artifacts:" -ForegroundColor Green
Get-ChildItem "$BuildDir\$BuildType" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object Name, Length

Write-Host "`nRunning kernel_tests..." -ForegroundColor Cyan
& "$BuildDir\$BuildType\kernel_tests.exe"
$kernelExit = $LASTEXITCODE

Write-Host "`nRunning requiem_tests..." -ForegroundColor Cyan
& "$BuildDir\$BuildType\requiem_tests.exe"
$testExit = $LASTEXITCODE

Write-Host ""
if ($kernelExit -eq 0 -and $testExit -eq 0) {
  Write-Host "ALL TESTS PASSED" -ForegroundColor Green
  exit 0
} else {
  Write-Host "TESTS FAILED (kernel=$kernelExit, requiem=$testExit)" -ForegroundColor Red
  exit 1
}
