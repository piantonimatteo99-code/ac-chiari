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

# Let's list the log entries.
$body = @{
    resourceNames = @("projects/ac-chiari-import-2024")
    filter = 'resource.type="build"'
    orderBy = "timestamp desc"
    pageSize = 100
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Method Post -Uri "https://logging.googleapis.com/v2/entries:list" -Headers $headers -Body $body
    if ($res.entries) {
        $logs = $res.entries | ForEach-Object {
            [PSCustomObject]@{
                timestamp = $_.timestamp
                severity = $_.severity
                logName = $_.logName
                textPayload = $_.textPayload
                jsonPayload = $_.jsonPayload
                labels = $_.labels
            }
        }
        $logs | ConvertTo-Json -Depth 10 | Out-File -FilePath "c:\Users\piant\OneDrive - unibs.it\Desktop\Programmi\ac-chiari\scratch\build_logs.json" -Encoding utf8
        Write-Output "Successfully wrote logs to scratch/build_logs.json"
    } else {
        Write-Warning "No log entries found."
    }
} catch {
    Write-Error "Request failed: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Error "Response body: $responseBody"
    }
}
