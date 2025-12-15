# Requer PowerShell 5+ e internet
$ErrorActionPreference = "Stop"

$base = $env:CREDIHOME_BASE_URL
if (-not $base) { $base = "https://api-partner.credihome.com.br/v1/production" }

$loginBody = @{ login = $env:CREDIHOME_LOGIN; password = $env:CREDIHOME_PASSWORD } | ConvertTo-Json
$tokenResp = Invoke-RestMethod -Method POST -Uri "$base/login" -Body $loginBody -ContentType "application/json"
$jwt = $tokenResp.token

$headers = @{
  "Authorization" = "Bearer $jwt"
  "Content-Type"  = "application/json"
  "Accept"        = "application/json"
}
if ($env:CREDIHOME_CHANNEL) { $headers["channel"] = $env:CREDIHOME_CHANNEL }

$body = @{
  valorImovel        = 400000
  valorEntrada       = 80000
  valorFinanciamento = 320000
  prazoPagamento     = 360
  sistema            = "API"
} | ConvertTo-Json

try {
  Write-Host "POST /simulador…"
  $resp = Invoke-RestMethod -Method POST -Uri "$base/simulador" -Headers $headers -Body $body
  $resp | Format-List *
} catch {
  $r = $_.Exception.Response
  if ($r) {
    $id = $r.Headers["x-amzn-RequestId"]
    $reader = New-Object IO.StreamReader($r.GetResponseStream())
    $txt = $reader.ReadToEnd()
    Write-Host "HTTP: $($r.StatusCode.value__) $($r.StatusDescription) | x-amzn-RequestId=$id" -ForegroundColor Red
    Write-Host $txt
  } else {
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
}
