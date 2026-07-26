$ErrorActionPreference = 'Stop'
$healthJson = (& .\build\requiem.exe health | Out-String).Trim()
Write-Output $healthJson
if ($healthJson -notmatch '"hash_primitive"\s*:\s*"blake3"') { throw 'hash primitive is not blake3' }
if ($healthJson -match '"hash_backend"\s*:\s*"(fallback|unavailable)"') { throw 'hash backend is not authoritative' }
& .\build\requiem.exe validate-replacement
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
