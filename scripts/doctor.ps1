#
# Requiem Environment Doctor (Windows PowerShell)
# Validates all required dependencies for building and running Requiem
#

$ErrorActionPreference = "Stop"

$ERR_MISSING_DEP = 1
$ERR_VERSION_MISMATCH = 2
$ERR_ENGINE_NOT_BUILT = 3

$checkPassed = 0
$checkFailed = 0

function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Green
}

function Write-Warn($message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Test-Command($command, $name) {
    try {
        $null = Get-Command $command -ErrorAction Stop
        Write-Info "$name found: $(Get-Command $command).Source"
        $script:checkPassed++
        return $true
    }
    catch {
        Write-Error "$name not found in PATH"
        $script:checkFailed++
        return $false
    }
}

function Test-Version($command, $minVersion, $name, $versionFlag = "--version") {
    try {
        $output = & $command $versionFlag 2>&1 | Select-Object -First 1
        $versionMatch = [regex]::Match($output, '(\d+)\.(\d+)(?:\.(\d+))?')
        
        if (-not $versionMatch.Success) {
            Write-Warn "Could not determine $name version from: $output"
            return $false
        }
        
        $currentVersion = $versionMatch.Value
        $currentParts = $currentVersion.Split('.')
        $minParts = $minVersion.Split('.')
        
        $currentMajor = [int]$currentParts[0]
        $currentMinor = [int]$currentParts[1]
        $minMajor = [int]$minParts[0]
        $minMinor = [int]$minParts[1]
        
        $isValid = ($currentMajor -gt $minMajor) -or 
                   (($currentMajor -eq $minMajor) -and ($currentMinor -ge $minMinor))
        
        if ($isValid) {
            Write-Info "$name version OK: $currentVersion (>= $minVersion)"
            $script:checkPassed++
            return $true
        }
        else {
            Write-Error "$name version too old: $currentVersion (requires >= $minVersion)"
            $script:checkFailed++
            return $false
        }
    }
    catch {
        Write-Error "Failed to check $name version: $_"
        $script:checkFailed++
        return $false
    }
}

function Test-VSBuildTools {
    # Check for Visual Studio Build Tools or Visual Studio
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    
    if (Test-Path $vsWhere) {
        try {
            $installations = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
            if ($installations) {
                Write-Info "Visual Studio Build Tools found: $($installations[0].displayName)"
                $script:checkPassed++
                return $true
            }
        }
        catch {
            # Fall through to manual checks
        }
    }
    
    # Manual check for cl.exe
    if (Get-Command "cl" -ErrorAction SilentlyContinue) {
        Write-Info "MSVC compiler (cl.exe) found"
        $script:checkPassed++
        return $true
    }
    
    # Check for CMake with generator support
    if (Get-Command "cmake" -ErrorAction SilentlyContinue) {
        $generators = cmake --help 2>&1 | Select-String "Visual Studio|Ninja"
        if ($generators) {
            Write-Info "CMake found with Windows generator support"
            $script:checkPassed++
            return $true
        }
    }
    
    Write-Error "Visual Studio Build Tools not found (required for C++ compilation)"
    Write-Info "Install from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022"
    $script:checkFailed++
    return $false
}

function Test-HeaderFile($header, $name) {
    # Check common Windows SDK locations
    $sdkPaths = @(
        "${env:WindowsSdkDir}Include",
        "${env:ProgramFiles(x86)}\Windows Kits\10\Include"
    )
    
    foreach ($basePath in $sdkPaths) {
        if ($basePath -and (Test-Path $basePath)) {
            $found = Get-ChildItem -Path $basePath -Recurse -Filter $header -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                Write-Info "$name headers found: $($found.FullName)"
                $script:checkPassed++
                return $true
            }
        }
    }
    
    # Check vcpkg locations
    $vcpkgPaths = @(
        "${env:VCPKG_ROOT}\installed",
        "C:\vcpkg\installed"
    )
    
    foreach ($basePath in $vcpkgPaths) {
        if ($basePath -and (Test-Path $basePath)) {
            $found = Get-ChildItem -Path $basePath -Recurse -Filter $header -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                Write-Info "$name headers found: $($found.FullName)"
                $script:checkPassed++
                return $true
            }
        }
    }
    
    Write-Error "$name headers not found (looked for $header)"
    $script:checkFailed++
    return $false
}

function Test-LibraryFile($lib, $name) {
    # Check common library locations
    $libPaths = @(
        "${env:WindowsSdkDir}Lib",
        "${env:ProgramFiles(x86)}\Windows Kits\10\Lib"
    )
    
    foreach ($basePath in $libPaths) {
        if ($basePath -and (Test-Path $basePath)) {
            $found = Get-ChildItem -Path $basePath -Recurse -Filter "$lib.lib" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                Write-Info "$name library found: $($found.FullName)"
                $script:checkPassed++
                return $true
            }
        }
    }
    
    Write-Error "$name library not found (looked for $lib.lib)"
    $script:checkFailed++
    return $false
}

Write-Host "====================================="
Write-Host "Requiem Environment Doctor"
Write-Host "====================================="
Write-Host ""

# Check Node.js
Write-Info "Checking Node.js..."
if (Test-Command "node" "Node.js") {
    Test-Version "node" "18.0.0" "Node.js"
}
Write-Host ""

# Check pnpm
Write-Info "Checking pnpm..."
if (Test-Command "pnpm" "pnpm") {
    Test-Version "pnpm" "8.0.0" "pnpm"
}
Write-Host ""

# Check CMake
Write-Info "Checking CMake..."
if (Test-Command "cmake" "CMake") {
    Test-Version "cmake" "3.20.0" "CMake"
}
Write-Host ""

# Check C++ compiler
Write-Info "Checking C++ compiler..."
Test-VSBuildTools
Write-Host ""

# Check OpenSSL
Write-Info "Checking OpenSSL..."
Test-HeaderFile "openssl\ssl.h" "OpenSSL"
Test-HeaderFile "openssl\evp.h" "OpenSSL EVP"
Write-Host ""

# Check zstd
Write-Info "Checking zstd..."
Test-LibraryFile "zstd" "zstd"
Write-Host ""

# Check for optional tools
Write-Info "Checking optional tools..."
if (Get-Command "git" -ErrorAction SilentlyContinue) {
    $gitVersion = git --version
    Write-Info "Git found: $gitVersion"
}
else {
    Write-Warn "Git not found (recommended for development)"
}

if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pyVersion = python --version 2>&1
    Write-Info "Python found: $pyVersion"
}
elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pyVersion = python3 --version
    Write-Info "Python 3 found: $pyVersion"
}
else {
    Write-Warn "Python not found (recommended for some scripts)"
}
Write-Host ""

# Check if engine binary exists
Write-Host "====================================="
Write-Info "Checking Requiem engine binary..."
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$enginePath = Join-Path $scriptDir "..\build\requiem.exe"

if (Test-Path $enginePath) {
    Write-Info "Requiem engine binary found: $enginePath"
    $checkPassed++
}
else {
    Write-Warn "Requiem engine binary not found at $enginePath"
    Write-Info "Run 'npm run build' to build the engine"
}
Write-Host ""

# Summary
Write-Host "====================================="
Write-Host "Summary: $checkPassed passed, $checkFailed failed"
Write-Host "====================================="

if ($checkFailed -eq 0) {
    Write-Info "All required dependencies are satisfied!"
    exit 0
}
else {
    Write-Error "Some required dependencies are missing or incorrect versions"
    Write-Info "Please install missing dependencies before proceeding"
    exit $ERR_MISSING_DEP
}
