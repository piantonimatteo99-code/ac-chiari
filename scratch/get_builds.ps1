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

$url = "https://firebaseapphosting.googleapis.com/v1beta/projects/ac-chiari-import-2024/locations/us-central1/backends/studio/builds"

try {
    $res = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
    if ($res.builds) {
        $builds = $res.builds | ForEach-Object {
            [PSCustomObject]@{
                name = $_.name
                state = $_.state
                createTime = $_.createTime
                updateTime = $_.updateTime
                commit = $_.source.codebase.commit
                id = ($_.name -split "/")[-1]
            }
        }
        $builds | ConvertTo-Json -Depth 5 | Out-File -FilePath "c:\Users\piant\OneDrive - unibs.it\Desktop\Programmi\ac-chiari\scratch\builds_list.json" -Encoding utf8
        Write-Output "Successfully wrote builds to scratch/builds_list.json"
    } else {
        Write-Warning "No builds found."
        $res | ConvertTo-Json | Out-File -FilePath "c:\Users\piant\OneDrive - unibs.it\Desktop\Programmi\ac-chiari\scratch\builds_list.json"
    }
} catch {
    Write-Error "Request failed: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Error "Response body: $responseBody"
    }
}
