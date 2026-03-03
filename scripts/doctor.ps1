#!/usr/bin/env pwsh
#
# Requiem Environment Doctor (Windows)
# Validates all required dependencies for building and running Requiem
#
# Usage:
#   .\doctor.ps1          # Run all checks and print human-readable output
#   .\doctor.ps1 --json   # Output results as JSON for machine parsing
#

param(
    [switch]$Json
)

$ErrorActionPreference = "Continue"

$ERR_MISSING_DEP = 1
$ERR_VERSION_MISMATCH = 2
$ERR_ENGINE_NOT_BUILT = 3

$check_passed = 0
$check_failed = 0
$results = @()

function Add-Result($status, $name, $message) {
    $results += [PSCustomObject]@{
        status = $status
        check = $name
        message = $message
    }
}

function Test-Command($cmd, $name) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        if (-not $Json) { Write-Host "[INFO] $name found: $($found.Source)" -ForegroundColor Green }
        $script:check_passed++
        return $true
    } else {
        if (-not $Json) { Write-Host "[ERROR] $name not found in PATH" -ForegroundColor Red }
        $script:check_failed++
        return $false
    }
}

function Test-Version($cmd, $minVersion, $name) {
    try {
        $output = & $cmd --version 2>&1 | Select-Object -First 1
        $version = [regex]::Match($output, '(\d+\.\d+(?:\.\d+)?)').Groups[1].Value
        
        if (-not $version) {
            if (-not $Json) { Write-Host "[WARN] Could not determine $name version" -ForegroundColor Yellow }
            return $false
        }
        
        $current = [Version]$version
        $required = [Version]$minVersion
        
        if ($current -ge $required) {
            if (-not $Json) { Write-Host "[INFO] $name version OK: $version (>= $minVersion)" -ForegroundColor Green }
            $script:check_passed++
            return $true
        } else {
            if (-not $Json) { Write-Host "[ERROR] $name version too old: $version (requires >= $minVersion)" -ForegroundColor Red }
            $script:check_failed++
            return $false
        }
    } catch {
        if (-not $Json) { Write-Host "[WARN] Could not check $name version" -ForegroundColor Yellow }
        return $false
    }
}

if (-not $Json) {
    Write-Host "====================================="
    Write-Host "Requiem Environment Doctor"
    Write-Host "====================================="
    Write-Host ""
}

# Check Node.js
if (-not $Json) { Write-Host "Checking Node.js..." -ForegroundColor Green }
if (Test-Command "node" "Node.js") {
    Test-Version "node" "18.0.0" "Node.js"
}
if (-not $Json) { Write-Host "" }

# Check pnpm
if (-not $Json) { Write-Host "Checking pnpm..." -ForegroundColor Green }
if (Test-Command "pnpm" "pnpm") {
    Test-Version "pnpm" "8.0.0" "pnpm"
}
if (-not $Json) { Write-Host "" }

# Check CMake
if (-not $Json) { Write-Host "Checking CMake..." -ForegroundColor Green }
if (Test-Command "cmake" "CMake") {
    Test-Version "cmake" "3.20.0" "CMake"
}
if (-not $Json) { Write-Host "" }

# Check C++ compiler
if (-not $Json) { Write-Host "Checking C++ compiler..." -ForegroundColor Green }
$hasCompiler = $false
if (Test-Command "cl" "MSVC") {
    $hasCompiler = $true
} elseif (Test-Command "g++" "GCC/G++") {
    Test-Version "g++" "11.0.0" "GCC"
    $hasCompiler = $true
} elseif (Test-Command "clang++" "Clang") {
    Test-Version "clang++" "13.0.0" "Clang"
    $hasCompiler = $true
}

if (-not $hasCompiler) {
    if (-not $Json) { Write-Host "[ERROR] No C++ compiler found" -ForegroundColor Red }
    $check_failed++
}
if (-not $Json) { Write-Host "" }

# Check for optional tools
if (-not $Json) { Write-Host "Checking optional tools..." -ForegroundColor Green }
if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitVersion = git --version
    if (-not $Json) { Write-Host "[INFO] Git found: $gitVersion" -ForegroundColor Green }
} else {
    if (-not $Json) { Write-Host "[WARN] Git not found (recommended for development)" -ForegroundColor Yellow }
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyVersion = python --version 2>&1
    if (-not $Json) { Write-Host "[INFO] Python found: $pyVersion" -ForegroundColor Green }
} else {
    if (-not $Json) { Write-Host "[WARN] Python not found (recommended for some scripts)" -ForegroundColor Yellow }
}
if (-not $Json) { Write-Host "" }

# Check if engine binary exists
if (-not $Json) {
    Write-Host "====================================="
    Write-Host "Checking Requiem engine binary..." -ForegroundColor Green
}
$enginePath = Join-Path $PSScriptRoot "..\build\Release\requiem.exe"
if (Test-Path $enginePath) {
    if (-not $Json) { Write-Host "[INFO] Requiem engine binary found: $enginePath" -ForegroundColor Green }
    $check_passed++
} else {
    $enginePathDebug = Join-Path $PSScriptRoot "..\build\Debug\requiem.exe"
    if (Test-Path $enginePathDebug) {
        if (-not $Json) { Write-Host "[INFO] Requiem engine binary found: $enginePathDebug" -ForegroundColor Green }
        $check_passed++
    } else {
        if (-not $Json) {
            Write-Host "[WARN] Requiem engine binary not found" -ForegroundColor Yellow
            Write-Host "[INFO] Run 'make build' or 'pnpm run build' to build the engine" -ForegroundColor Green
        }
    }
}
if (-not $Json) { Write-Host "" }

# Summary
if (-not $Json) {
    Write-Host "====================================="
    Write-Host "Summary: $check_passed passed, $check_failed failed"
    Write-Host "====================================="

    if ($check_failed -eq 0) {
        Write-Host "[INFO] All required dependencies are satisfied!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[ERROR] Some required dependencies are missing or incorrect versions" -ForegroundColor Red
        Write-Host "[INFO] Please install missing dependencies before proceeding" -ForegroundColor Green
        exit $ERR_MISSING_DEP
    }
} else {
    @{ passed = $check_passed; failed = $check_failed; results = $results } | ConvertTo-Json -Depth 3
}
