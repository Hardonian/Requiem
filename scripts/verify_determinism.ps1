#!/usr/bin/env pwsh
# scripts/verify_determinism.ps1
# Determinism verification across sequential repeats and concurrent runs.
# Emits: artifacts/reports/determinism_report.json

param(
    [string]$BuildDir = "build",
    [int]$Runs = 20, # Reduced default for local run
    [string]$ReportDir = "artifacts/reports"
)

$ErrorActionPreference = "Stop"
$cli = "$BuildDir/requiem_cli.exe"
if (-not (Test-Path $cli)) {
    Write-Error "Requiem CLI not found at $cli. Please build the project first."
    exit 1
}

if (-not (Test-Path $ReportDir)) {
    $null = New-Item -ItemType Directory -Path $ReportDir -Force
}

$tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "requiem_det_" + [Guid]::NewGuid().ToString())
$null = New-Item -ItemType Directory -Path $tempDir

$reportFile = Join-Path $ReportDir "determinism_report.json"
$script:overallPass = $true
$script:fixtureResults = @()
$script:totalRuns = 0
$script:totalDrift = 0
$startTime = [DateTime]::Now

function Write-Header($text) {
    Write-Host "`n=== $text ===" -ForegroundColor Cyan
}

function Test-RequiemFixture($label, $requestFile, $n) {
    Write-Host "  fixture[$label]: running $n times..."
    $firstDigest = $null
    $driftCount = 0
    $fixtureStart = [DateTime]::Now

    for ($i = 1; $i -le $n; $i++) {
        $outFile = Join-Path $tempDir "result_$($label)_$($i).json"
        & $cli exec run --request $requestFile --out $outFile | Out-Null

        if ($LASTEXITCODE -ne 0) {
            Write-Host "    FAIL run $($i): exec returned non-zero" -ForegroundColor Red
            $driftCount++
            continue
        }

        $result = Get-Content $outFile | ConvertFrom-Json
        $digest = $result.result_digest

        if (-not $digest) {
            Write-Host "    FAIL run $($i): no result_digest in output" -ForegroundColor Red
            $driftCount++
            continue
        }

        if ($null -eq $firstDigest) {
            $firstDigest = $digest
        }
        elseif ($digest -ne $firstDigest) {
            Write-Host "    DRIFT run $($i): $digest != $firstDigest" -ForegroundColor Red
            $driftCount++
        }
    }

    $fixtureEnd = [DateTime]::Now
    $elapsed = [Math]::Round(($fixtureEnd - $fixtureStart).TotalSeconds, 2)
    $pass = $driftCount -eq 0
    if (-not $pass) { $script:overallPass = $false }

    $script:totalRuns += $n
    $script:totalDrift += $driftCount

    $fixtureRecord = @{
        label            = $label
        runs             = $n
        drift_count      = $driftCount
        pass             = $pass
        reference_digest = $firstDigest
        elapsed_s        = $elapsed
    }
    $script:fixtureResults += $fixtureRecord

    $statusColor = if ($pass) { "Green" } else { "Red" }
    $statusText = if ($pass) { "PASS" } else { "FAIL" }
    Write-Host "  fixture[$label]: $statusText (drift=$driftCount/$n, ${elapsed}s)" -ForegroundColor $statusColor
}

Write-Header "verify:determinism — $Runs x sequential"

# Create inline fixture
$inlineRequest = @{
    request_id       = "determinism-gate"
    workspace_root   = "."
    command          = "cmd.exe"
    argv             = @("/c", "echo determinism-fixture-output")
    timeout_ms       = 2000
    max_output_bytes = 4096
    policy           = @{ deterministic = $true; mode = "strict" }
} | ConvertTo-Json

$inlineRequestFile = Join-Path $tempDir "inline.request.json"
$inlineRequest | Out-File -FilePath $inlineRequestFile -Encoding utf8

Test-RequiemFixture "inline" $inlineRequestFile $Runs

# Concurrent arm
Write-Header "concurrent arm: 3 workers x 10 runs"
$concurrentPass = $true
$concurrentDrift = 0

$jobs = @()
for ($w = 1; $w -le 3; $w++) {
    $job = Start-Job -ScriptBlock {
        param($cli, $requestFile, $tempDir, $w)
        $firstD = $null
        $drift = 0
        for ($r = 1; $r -le 10; $r++) {
            $out = Join-Path $tempDir "conc_$($w)_$($r).json"
            & $cli exec run --request $requestFile --out $out | Out-Null
            $res = Get-Content $out | ConvertFrom-Json
            $d = $res.result_digest
            if ($null -eq $firstD) { $firstD = $d }
            if ($d -ne $firstD) { $drift++ }
        }
        return @{ worker = $w; digest = $firstD; drift = $drift }
    } -ArgumentList $cli, $inlineRequestFile, $tempDir, $w
    $jobs += $job
}

$jobResults = Wait-Job $jobs | Receive-Job
$concurrentRef = $null

foreach ($res in $jobResults) {
    if ($res.drift -gt 0) { $concurrentDrift++; $concurrentPass = $false }
    if ($null -eq $concurrentRef) {
        $concurrentRef = $res.digest
    }
    elseif ($res.digest -ne $concurrentRef) {
        $concurrentDrift++
        $concurrentPass = $false
    }
}

if (-not $concurrentPass) { $script:overallPass = $false }
Write-Host "  concurrent arm: $(if ($concurrentPass) { 'PASS' } else { 'FAIL' }) (cross-worker drift=$concurrentDrift)" -ForegroundColor (if ($concurrentPass) { 'Green' } else { 'Red' })

# Final report
$endTime = [DateTime]::Now
$wallTime = [Math]::Round(($endTime - $startTime).TotalSeconds, 2)

$report = @{
    schema           = "determinism_report_v2"
    pass             = $script:overallPass
    total_runs       = $script:totalRuns
    total_drift      = $script:totalDrift
    concurrent_drift = $concurrentDrift
    concurrent_pass  = $concurrentPass
    wall_time_s      = $wallTime
    hash_primitive   = "blake3"
    fixtures         = $script:fixtureResults
}

$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding utf8

Write-Host "`nReport: $reportFile"
if ($script:overallPass) {
    Write-Host "=== verify:determinism PASSED (total_runs=$($script:totalRuns), drift=0) ===" -ForegroundColor Green
}
else {
    Write-Host "=== verify:determinism FAILED (drift=$($script:totalDrift)/$($script:totalRuns)) ===" -ForegroundColor Red
}

# Cleanup
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

if (-not $script:overallPass) { exit 1 }
exit 0
