#!/usr/bin/env pwsh
# Main verification script for Requiem v1.3
# Runs all verification steps

param(
    [string]$BuildDir = "build",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptsDir

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success($text) {
    Write-Host "✓ $text" -ForegroundColor Green
}

function Write-Failure($text) {
    Write-Host "✗ $text" -ForegroundColor Red
}

Set-Location $repoRoot

# Step 1: Build
Write-Header "Step 1: Building Requiem"

if (-not $SkipBuild) {
    if (-not (Test-Path $BuildDir)) {
        New-Item -ItemType Directory -Path $BuildDir | Out-Null
    }
    
    cmake -S . -B $BuildDir -DCMAKE_BUILD_TYPE=Release
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "CMake configuration failed"
        exit 1
    }
    
    cmake --build $BuildDir --config Release
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Build failed"
        exit 1
    }
    Write-Success "Build completed"
} else {
    Write-Success "Build skipped (using existing)"
}

# Step 2: Unit Tests
Write-Header "Step 2: Running Unit Tests"

ctest --test-dir $BuildDir --output-on-failure -C Release
if ($LASTEXITCODE -ne 0) {
    Write-Failure "Unit tests failed"
    exit 1
}
Write-Success "Unit tests passed"

# Step 3: Hash Backend Verification
Write-Header "Step 3: Verifying Hash Backend"

& "$BuildDir/requiem_cli.exe" health | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Failure "Health check failed"
    exit 1
}

$health = & "$BuildDir/requiem_cli.exe" health | ConvertFrom-Json
if ($health.hash_primitive -ne "blake3") {
    Write-Failure "Hash primitive is not BLAKE3"
    exit 1
}
if ($health.hash_backend -ne "vendored") {
    Write-Failure "Hash backend is not vendored"
    exit 1
}
Write-Success "BLAKE3 vendored implementation verified"

# Step 4: Smoke Tests
Write-Header "Step 4: Running Smoke Tests"

& "$scriptsDir/verify_smoke.ps1" -BuildDir $BuildDir
if ($LASTEXITCODE -ne 0) {
    Write-Failure "Smoke tests failed"
    exit 1
}
Write-Success "Smoke tests passed"

# Step 5: Contract Tests
Write-Header "Step 5: Running Contract Tests"

& "$scriptsDir/verify_contract.ps1" -BuildDir $BuildDir
if ($LASTEXITCODE -ne 0) {
    Write-Failure "Contract tests failed"
    exit 1
}
Write-Success "Contract tests passed"

# Step 6: Validation
Write-Header "Step 6: Replacement Validation"

& "$BuildDir/requiem_cli.exe" validate-replacement | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Failure "Replacement validation failed"
    exit 1
}
Write-Success "Replacement validation passed"

# Step 7: Doctor Check
Write-Header "Step 7: Doctor Health Check"

& "$BuildDir/requiem_cli.exe" doctor | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Failure "Doctor check failed"
    exit 1
}
Write-Success "Doctor health check passed"

Write-Header "All Verifications Passed"
Write-Success "Requiem v1.3 is ready for deployment"
