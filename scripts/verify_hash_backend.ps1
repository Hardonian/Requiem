$ErrorActionPreference = 'Stop'
$binary = Get-ChildItem -Path .\build -Filter requiem.exe -Recurse -File | Select-Object -First 1
if ($null -eq $binary) { throw 'Could not find requiem.exe under build/' }
$healthJson = (& $binary.FullName health | Out-String).Trim()
Write-Output $healthJson
if ($healthJson -notmatch '"hash_primitive"\s*:\s*"blake3"') { throw 'hash primitive is not blake3' }
if ($healthJson -match '"hash_backend"\s*:\s*"(fallback|unavailable)"') { throw 'hash backend is not authoritative' }
& $binary.FullName validate-replacement
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
