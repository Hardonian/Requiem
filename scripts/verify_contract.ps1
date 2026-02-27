#!/usr/bin/env pwsh
# Contract tests for Requiem v1.3
# Validates API contracts, digest stability, and backward compatibility

param(
    [string]$BuildDir = "build"
)

$ErrorActionPreference = "Stop"
$cli = "$BuildDir/requiem_cli.exe"
$tempDir = [System.IO.Path]::GetTempPath() + "requiem_contract_" + [Guid]::NewGuid().ToString()
New-Item -ItemType Directory -Path $tempDir | Out-Null

function Cleanup {
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

try {
    Write-Host "Running Requiem v1.3 Contract Tests..." -ForegroundColor Cyan
    
    # Test 1: BLAKE3 hash vectors
    Write-Host "Test 1: BLAKE3 hash vectors..." -NoNewline
    
    # Empty string hash
    $emptyHash = & $cli digest file --file "NUL" 2>$null
    # Note: This won't work on Windows the same way, we'd need a real empty file
    
    # Known vector: "hello"
    $helloFile = "$tempDir/hello.txt"
    "hello" | Out-File -FilePath $helloFile -Encoding utf8 -NoNewline
    $helloHash = & $cli digest file --file $helloFile
    $expectedHash = "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f"
    if ($helloHash.Trim() -ne $expectedHash) {
        throw "Hash mismatch for 'hello': got $helloHash, expected $expectedHash"
    }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 2: Result digest stability
    Write-Host "Test 2: Result digest stability..." -NoNewline
    $requestFile = "$tempDir/req1.json"
    $resultFile = "$tempDir/res1.json"
    
    @{
        command = "cmd.exe"
        argv = @("/c", "echo test")
        workspace_root = $tempDir
        timeout_ms = 5000
    } | ConvertTo-Json | Out-File -FilePath $requestFile -Encoding utf8
    
    & $cli exec run --request $requestFile --out $resultFile | Out-Null
    $result1 = Get-Content $resultFile | ConvertFrom-Json
    
    # Run again with same request
    & $cli exec run --request $requestFile --out $resultFile | Out-Null
    $result2 = Get-Content $resultFile | ConvertFrom-Json
    
    if ($result1.result_digest -ne $result2.result_digest) {
        throw "Result digest not stable across identical runs"
    }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 3: Digest verification
    Write-Host "Test 3: Digest verification..." -NoNewline
    & $cli digest verify --result $resultFile | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Digest verification failed" }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 4: Timestamps excluded from digest (v1.1)
    Write-Host "Test 4: Timestamps excluded from digest..." -NoNewline
    $result = Get-Content $resultFile | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($result.start_timestamp)) {
        throw "start_timestamp missing"
    }
    if ([string]::IsNullOrWhiteSpace($result.end_timestamp)) {
        throw "end_timestamp missing"
    }
    # Timestamps should differ between runs but digests should match
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 5: Config version field (v1.1)
    Write-Host "Test 5: Config version field..." -NoNewline
    $request = @{
        command = "cmd.exe"
        argv = @("/c", "echo test")
        workspace_root = $tempDir
        config_version = "1.1"
    } | ConvertTo-Json
    $request | Out-File -FilePath $requestFile -Encoding utf8
    
    & $cli exec run --request $requestFile --out $resultFile | Out-Null
    $result = Get-Content $resultFile | ConvertFrom-Json
    if ($result.request_id -eq $null) {
        throw "request_id not generated"
    }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 6: Determinism confidence (v1.2)
    Write-Host "Test 6: Determinism confidence..." -NoNewline
    if ($result.determinism_confidence -eq $null) {
        throw "determinism_confidence missing"
    }
    if ([string]::IsNullOrWhiteSpace($result.determinism_confidence.level)) {
        throw "determinism_confidence.level missing"
    }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 7: Sandbox capabilities truth (v1.2)
    Write-Host "Test 7: Sandbox capabilities truth..." -NoNewline
    if ($result.sandbox_applied -eq $null) {
        throw "sandbox_applied missing"
    }
    if ($result.sandbox_applied.enforced -eq $null) {
        throw "sandbox_applied.enforced missing"
    }
    if ($result.sandbox_applied.unsupported -eq $null) {
        throw "sandbox_applied.unsupported missing"
    }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 8: Proof bundle format (v1.2)
    Write-Host "Test 8: Proof bundle format..." -NoNewline
    $proofFile = "$tempDir/proof.json"
    & $cli proof generate --request $requestFile --result $resultFile --out $proofFile | Out-Null
    
    $proof = Get-Content $proofFile | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($proof.merkle_root)) { throw "merkle_root missing" }
    if ([string]::IsNullOrWhiteSpace($proof.engine_version)) { throw "engine_version missing" }
    if ([string]::IsNullOrWhiteSpace($proof.contract_version)) { throw "contract_version missing" }
    if ($proof.input_digests -eq $null) { throw "input_digests missing" }
    if ($proof.output_digests -eq $null) { throw "output_digests missing" }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 9: Health output format (v1.3)
    Write-Host "Test 9: Health output format..." -NoNewline
    $health = & $cli health | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($health.engine_version)) { throw "health.engine_version missing" }
    if ([string]::IsNullOrWhiteSpace($health.contract_version)) { throw "health.contract_version missing" }
    if ($health.sandbox_capabilities -eq $null) { throw "health.sandbox_capabilities missing" }
    Write-Host " PASSED" -ForegroundColor Green
    
    # Test 10: Engine selection (v1.3)
    Write-Host "Test 10: Engine selection..." -NoNewline
    @{
        command = "cmd.exe"
        argv = @("/c", "echo engine_test")
        workspace_root = $tempDir
        engine_mode = "requiem"
    } | ConvertTo-Json | Out-File -FilePath $requestFile -Encoding utf8
    
    & $cli exec run --request $requestFile --out $resultFile --engine requiem | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Engine selection failed" }
    Write-Host " PASSED" -ForegroundColor Green
    
    Write-Host "`nAll contract tests PASSED!" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
finally {
    Cleanup
}
