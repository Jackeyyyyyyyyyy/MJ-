$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $root '.env.local'

if (-not (Test-Path -LiteralPath $envFile)) {
  @'
AI_REQUEST_TIMEOUT_MS=12000
APP_PASSWORD=123456
AUTH_SECRET=replace-with-a-long-random-session-secret
DATA_DIR=./data
OPENAI_API_BASE=https://qweapi.com/v1
OPENAI_API_KEY=replace-with-your-api-key
OPENAI_MODEL=claude-haiku-4-5-20251001
'@ | Set-Content -LiteralPath $envFile -Encoding UTF8
}

Write-Host ''
Write-Host 'The environment file will open now. Save and close Notepad to start localhost.' -ForegroundColor Cyan
Write-Host "Env file: $envFile" -ForegroundColor DarkGray
Start-Process -FilePath notepad.exe -ArgumentList "`"$envFile`"" -Wait

$loaded = 0
Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) {
    return
  }

  $equalsIndex = $line.IndexOf('=')
  if ($equalsIndex -lt 1) {
    return
  }

  $name = $line.Substring(0, $equalsIndex).Trim()
  $value = $line.Substring($equalsIndex + 1).Trim()

  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  if ($name) {
    Set-Item -Path "Env:$name" -Value $value
    $loaded += 1
  }
}

Write-Host ''
Write-Host "Loaded $loaded environment variables." -ForegroundColor Green
Write-Host 'Starting API and web servers...' -ForegroundColor Cyan

$api = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'api') -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 2
$web = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 4

Start-Process 'http://localhost:3000'

Write-Host ''
Write-Host 'Started: http://localhost:3000' -ForegroundColor Green
Write-Host "API process: $($api.Id); Web process: $($web.Id)" -ForegroundColor DarkGray
Write-Host 'Close the npm windows to stop the local servers.'
Write-Host ''
Read-Host 'Press Enter to close this launcher window'

