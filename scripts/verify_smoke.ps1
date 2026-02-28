#!/usr/bin/env pwsh
# Smoke tests for Requiem v1.3

param(
    [string]$BuildDir = "build"
)

$ErrorActionPreference = "Stop"
$cli = "$BuildDir/requiem.exe"
$tempDir = [System.IO.Path]::GetTempPath() + "requiem_smoke_" + [Guid]::NewGuid().ToString()
New-Item -ItemType Directory -Path $tempDir | Out-Null

function Cleanup {
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

try {
    Write-Host "Running Requiem v1.3 Smoke Tests..." -ForegroundColor Cyan

    # Test 1: Health check
    Write-Host "Test 1: Health check..." -NoNewline
    $health = & $cli health | ConvertFrom-Json
    if ($health.hash_primitive -ne "blake3") { throw "Health check failed" }
    if ($health.engine_version -ne "1.2") { throw "Expected engine version 1.2" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 2: Doctor
    Write-Host "Test 2: Doctor check..." -NoNewline
    & $cli doctor | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Doctor check failed" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 3: Config show
    Write-Host "Test 3: Config show..." -NoNewline
    $config = & $cli config show | ConvertFrom-Json
    if ($config.config.version -ne "1.2") { throw "Config version mismatch" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 4: Config validation
    Write-Host "Test 4: Config validation..." -NoNewline
    $testConfig = '{"config_version":"1.1","hash":{"primitive":"blake3"}}'
    $configFile = "$tempDir/config.json"
    $testConfig | Out-File -FilePath $configFile -Encoding utf8
    $validation = & $cli config validate --file $configFile | ConvertFrom-Json
    if (-not $validation.ok) { throw "Config validation failed" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 5: Metrics
    Write-Host "Test 5: Metrics (JSON)..." -NoNewline
    $metrics = & $cli metrics --format json | ConvertFrom-Json
    if ($null -eq $metrics.exec_total) { throw "Metrics missing exec_total" }
    Write-Host " PASSED" -ForegroundColor Green

    Write-Host "Test 5b: Metrics (Prometheus)..." -NoNewline
    $prom = & $cli metrics --format prom
    if (-not $prom.Contains("requiem_exec_total")) { throw "Prometheus format missing metric" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 6: CAS operations
    Write-Host "Test 6: CAS put..." -NoNewline
    $testFile = "$tempDir/test_data.txt"
    "Hello CAS" | Out-File -FilePath $testFile -Encoding utf8
    $digest = & $cli cas put --in $testFile --cas "$tempDir/cas"
    if ([string]::IsNullOrWhiteSpace($digest)) { throw "CAS put failed" }
    Write-Host " PASSED" -ForegroundColor Green

    Write-Host "Test 6b: CAS info..." -NoNewline
    $info = & $cli cas info --hash $digest --cas "$tempDir/cas" | ConvertFrom-Json
    if ($info.digest -ne $digest) { throw "CAS info mismatch" }
    Write-Host " PASSED" -ForegroundColor Green

    Write-Host "Test 6c: CAS verify..." -NoNewline
    & $cli cas verify --cas "$tempDir/cas" --all | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "CAS verify failed" }
    Write-Host " PASSED" -ForegroundColor Green

    Write-Host "Test 6d: CAS stats..." -NoNewline
    $stats = & $cli cas stats --cas "$tempDir/cas" --top 10 | ConvertFrom-Json
    if ($stats.total_objects -lt 1) { throw "CAS stats incorrect" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 7: Execution
    Write-Host "Test 7: Execution..." -NoNewline
    $request = @{
        command        = "cmd.exe"
        argv           = @("/c", "echo hello")
        workspace_root = $tempDir
        timeout_ms     = 5000
    } | ConvertTo-Json
    $requestFile = "$tempDir/request.json"
    $resultFile = "$tempDir/result.json"
    $request | Out-File -FilePath $requestFile -Encoding utf8

    & $cli exec run --request $requestFile --out $resultFile | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Execution failed" }

    $result = Get-Content $resultFile | ConvertFrom-Json
    if (-not $result.ok) { throw "Execution result not ok" }
    if ($result.stdout -ne "hello") { throw "Execution output mismatch" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 8: Proof bundle (v1.2)
    Write-Host "Test 8: Proof bundle generation..." -NoNewline
    $proofFile = "$tempDir/proof.json"
    & $cli proof generate --request $requestFile --result $resultFile --out $proofFile | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Proof generation failed" }

    $proof = Get-Content $proofFile | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($proof.merkle_root)) { throw "Proof missing merkle_root" }
    Write-Host " PASSED" -ForegroundColor Green

    Write-Host "Test 8b: Proof verification..." -NoNewline
    & $cli proof verify --bundle $proofFile | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Proof verification failed" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 9: Validate replacement
    Write-Host "Test 9: Validate replacement..." -NoNewline
    & $cli validate-replacement | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Replacement validation failed" }
    Write-Host " PASSED" -ForegroundColor Green

    # Test 10: Policy
    Write-Host "Test 10: Policy check..." -NoNewline
    $policyCheck = & $cli policy check --request $requestFile | ConvertFrom-Json
    if (-not $policyCheck.ok) { throw "Policy check failed" }
    Write-Host " PASSED" -ForegroundColor Green

    Write-Host "`nAll smoke tests PASSED!" -ForegroundColor Green
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
