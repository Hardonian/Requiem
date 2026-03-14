#!/usr/bin/env pwsh
param(
    [switch]$Json
)

$requiredNode = [Version]"20.11.0"
$requiredPnpm = [Version]"8.15.0"
$requiredCmake = [Version]"3.20.0"
$requiredGcc = [Version]"11.0.0"
$requiredClang = [Version]"14.0.0"

$script:passed = 0
$script:failed = 0
$script:warnings = 0
$results = New-Object System.Collections.Generic.List[object]

function Write-Log($Level, $Message) {
    if ($Json) { return }
    switch ($Level) {
        "INFO" { Write-Host "[INFO] $Message" -ForegroundColor Green }
        "WARN" { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "ERROR" { Write-Host "[ERROR] $Message" -ForegroundColor Red }
        default { Write-Host $Message }
    }
}

function Add-Result($ok, $check, $message, $remediation = "") {
    $results.Add([PSCustomObject]@{
        ok = $ok
        check = $check
        message = $message
        remediation = $remediation
    })
}

function Parse-Version([string]$Output) {
    $match = [regex]::Match($Output, '(\d+\.\d+(?:\.\d+)?)')
    if ($match.Success) { return [Version]$match.Groups[1].Value }
    return $null
}

function Test-ToolVersion($Command, $Name, [Version]$Minimum, $Remediation) {
    $tool = Get-Command $Command -ErrorAction SilentlyContinue
    if (-not $tool) {
        $script:failed++
        Add-Result $false $Name "Missing from PATH." $Remediation
        Write-Log "ERROR" "$Name missing from PATH. $Remediation"
        return
    }

    $versionOutput = (& $Command --version 2>&1 | Select-Object -First 1)
    $parsedVersion = Parse-Version $versionOutput

    if (-not $parsedVersion) {
        $script:warnings++
        Add-Result $true $Name "Found, but version could not be parsed from: $versionOutput"
        Write-Log "WARN" "$Name found but version could not be parsed ($versionOutput)."
        return
    }

    if ($parsedVersion -ge $Minimum) {
        $script:passed++
        Add-Result $true $Name "Version $parsedVersion satisfies >= $Minimum."
        Write-Log "INFO" "$Name version OK: $parsedVersion (>= $Minimum)"
    } else {
        $script:failed++
        Add-Result $false $Name "Version $parsedVersion is below required $Minimum." $Remediation
        Write-Log "ERROR" "$Name version too old: $parsedVersion (requires >= $Minimum). $Remediation"
    }
}

function Test-Compiler {
    $remediation = "Install a C++20 compiler and rerun: pnpm run doctor"

    if (Get-Command cl -ErrorAction SilentlyContinue) {
        $script:passed++
        Add-Result $true "MSVC" "MSVC compiler detected."
        Write-Log "INFO" "MSVC compiler detected."
        return
    }

    if (Get-Command g++ -ErrorAction SilentlyContinue) {
        Test-ToolVersion "g++" "GCC/G++" $requiredGcc $remediation
        return
    }

    if (Get-Command clang++ -ErrorAction SilentlyContinue) {
        Test-ToolVersion "clang++" "Clang" $requiredClang $remediation
        return
    }

    $script:failed++
    Add-Result $false "C++ compiler" "No supported compiler found (MSVC, g++, or clang++)." $remediation
    Write-Log "ERROR" "No supported C++ compiler found (MSVC, g++ >= $requiredGcc, or clang++ >= $requiredClang). $remediation"
}

function Test-EngineBinary {
    $release = Join-Path $PSScriptRoot "..\build\Release\requiem.exe"
    $debug = Join-Path $PSScriptRoot "..\build\Debug\requiem.exe"

    if ((Test-Path $release) -or (Test-Path $debug)) {
        $path = if (Test-Path $release) { $release } else { $debug }
        $script:passed++
        Add-Result $true "Engine binary" "Found at $path."
        Write-Log "INFO" "Requiem engine binary found: $path"
        return
    }

    $script:warnings++
    Add-Result $true "Engine binary" "Missing local engine build artifact." "Run: pnpm run build:engine"
    Write-Log "WARN" "Engine binary missing from build output."
    Write-Log "INFO" "Run: pnpm run build:engine"
    Write-Log "INFO" "If build fails, confirm CMake and a supported C++ toolchain are installed."
}

if (-not $Json) {
    Write-Host "====================================="
    Write-Host "Requiem Environment Doctor"
    Write-Host "====================================="
    Write-Host ""
}

Write-Log "INFO" "Checking required toolchain..."
Test-ToolVersion "node" "Node.js" $requiredNode "Install Node.js >= 20.11.0 and rerun: pnpm install --frozen-lockfile"
Test-ToolVersion "pnpm" "pnpm" $requiredPnpm "Install pnpm >= 8.15.0 (packageManager: pnpm@8.15.0) and rerun: pnpm install --frozen-lockfile"
Test-ToolVersion "cmake" "CMake" $requiredCmake "Install CMake >= 3.20.0 and rerun: pnpm run build:engine"
Test-Compiler
Write-Log "INFO" "Checking local engine build state..."
Test-EngineBinary

if ($Json) {
    [PSCustomObject]@{
        passed = $script:passed
        failed = $script:failed
        warnings = $script:warnings
        results = $results
    } | ConvertTo-Json -Depth 4
    exit $script:failed
}

Write-Host ""
Write-Host "====================================="
Write-Host "Summary: $script:passed passed, $script:failed failed, $script:warnings warnings"
Write-Host "====================================="

if ($script:failed -eq 0) {
    Write-Log "INFO" "Doctor found no blocking prerequisites."
    exit 0
}

Write-Log "ERROR" "Doctor found blocking prerequisites."
Write-Log "INFO" "Resolve the errors above, then rerun: pnpm run doctor"
exit 1
