$configPath = "$env:USERPROFILE\.config\configstore\firebase-tools.json"
if (-not (Test-Path $configPath)) {
    Write-Error "Firebase config not found at $configPath"
    exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json
$token = $config.tokens.access_token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$url = "https://firebaseapphosting.googleapis.com/v1beta/projects/ac-chiari-import-2024/locations/us-central1/backends/studio/builds/build-2026-06-05-001"

Write-Output "Starting wait loop for build-2026-06-05-001..."

for ($i = 0; $i -lt 60; $i++) {
    try {
        $res = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
        $state = $res.state
        Write-Output "Current build state: $state"
        if ($state -eq "READY" -or $state -eq "FAILED") {
            Write-Output "Build finished with state: $state"
            exit 0
        }
    } catch {
        Write-Warning "Error checking build state: $_"
    }
    Start-Sleep -Seconds 10
}

Write-Error "Timeout waiting for build to finish."
exit 1
