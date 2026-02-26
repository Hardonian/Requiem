# verify_secrets.ps1 - Scan for potential secrets in logs and test outputs
$ErrorActionPreference = 'Stop'

Write-Output "Scanning for potential secrets..."

$patterns = @(
    'password\s*=\s*[^\s"]+',
    'secret\s*=\s*[^\s"]+',
    'token\s*=\s*[^\s"]+',
    'api[_-]?key\s*=\s*[^\s"]+',
    'private[_-]?key\s*=\s*[^\s"]+',
    'Authorization:\s*Bearer\s+[^\s"]+',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
)

$found = $false

foreach ($pattern in $patterns) {
    $matches = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | 
        Select-String -Pattern $pattern -ErrorAction SilentlyContinue | 
        Where-Object { $_.Path -notlike "*verify_secrets*" } |
        Select-Object -First 5
    
    if ($matches) {
        $found = $true
        Write-Output "WARNING: Potential secret pattern found: $pattern"
        $matches | ForEach-Object { Write-Output $_.Line }
    }
}

if ($found) {
    Write-Output "SECRET CHECK: FAILED - Review output above"
    exit 1
} else {
    Write-Output "SECRET CHECK: PASSED - No obvious secrets found"
}
