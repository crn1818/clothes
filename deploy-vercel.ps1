# ================= Croma -> Vercel =================
# Publica o app na Vercel via API REST (sem CLI interativa).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File deploy-vercel.ps1 -Token SEU_TOKEN
#   (ou defina $env:VERCEL_TOKEN e rode sem o parametro)
#
# Crie um token em: https://vercel.com/account/settings/tokens
#
# O script roda "npm run build" e envia o conteudo de dist/ como site estatico.
param(
  [string]$Token = $env:VERCEL_TOKEN,
  [string]$ProjectName = 'croma',
  [string]$TeamId = 'team_Iwmq0zW3tqB5rAf7m6cp2Tlv',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $Token) {
  Write-Host 'ERRO: informe o token da Vercel (-Token XXX ou $env:VERCEL_TOKEN).' -ForegroundColor Red
  Write-Host 'Crie um em: https://vercel.com/account/settings/tokens' -ForegroundColor Yellow
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root 'dist'

if (-not $SkipBuild) {
  Write-Host 'Rodando o build...' -ForegroundColor Cyan
  Push-Location $root
  & npm run build
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Write-Host 'ERRO: o build falhou.' -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path $dist)) {
  Write-Host 'ERRO: pasta dist/ nao encontrada. Rode "npm run build" antes.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host 'Arquivos do deploy:' -ForegroundColor Cyan
$files = @()
foreach ($item in Get-ChildItem -Path $dist -Recurse -File) {
  $rel = $item.FullName.Substring($dist.Length + 1) -replace '\\', '/'
  $bytes = [System.IO.File]::ReadAllBytes($item.FullName)
  $files += @{ file = $rel; data = [Convert]::ToBase64String($bytes); encoding = 'base64' }
  Write-Host ("  + {0}  ({1:N0} bytes)" -f $rel, $bytes.Length)
}
if ($files.Count -eq 0) { Write-Host 'ERRO: dist/ esta vazia.' -ForegroundColor Red; exit 1 }

$body = @{
  name            = $ProjectName
  target          = 'production'
  files           = $files
  projectSettings = @{
    framework       = $null
    buildCommand    = $null
    installCommand  = $null
    outputDirectory = $null
  }
} | ConvertTo-Json -Depth 6 -Compress

$qs = ''
if ($TeamId) { $qs = "?teamId=$TeamId" }
$headers = @{ Authorization = "Bearer $Token" }

Write-Host ''
Write-Host 'Enviando deployment para a Vercel...' -ForegroundColor Cyan
try {
  $dep = Invoke-RestMethod -Method Post -Uri "https://api.vercel.com/v13/deployments$qs" `
           -Headers $headers -ContentType 'application/json' -Body $body
} catch {
  $msg = $_.ErrorDetails.Message
  if (-not $msg -and $_.Exception.Response) {
    $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
    $msg = $sr.ReadToEnd()
  }
  Write-Host "FALHOU: $msg" -ForegroundColor Red
  exit 1
}

Write-Host ("Deployment criado: https://{0}" -f $dep.url) -ForegroundColor Green
Write-Host 'Aguardando ficar pronto (READY)...'

$deadline = (Get-Date).AddMinutes(3)
$state = $dep.readyState
while (@('READY','ERROR','CANCELED') -notcontains $state -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 4
  $chk = Invoke-RestMethod -Method Get -Uri "https://api.vercel.com/v13/deployments/$($dep.id)$qs" -Headers $headers
  $state = $chk.readyState
  Write-Host "  estado: $state"
}

if ($state -ne 'READY') {
  Write-Host "Deployment terminou em '$state' - veja o painel da Vercel." -ForegroundColor Yellow
  exit 1
}

Write-Host ''
Write-Host '=== Croma publicado! ===' -ForegroundColor Green
try {
  $dom = Invoke-RestMethod -Method Get -Uri "https://api.vercel.com/v9/projects/$ProjectName/domains$qs" -Headers $headers
  foreach ($d in $dom.domains) { Write-Host ("  https://{0}" -f $d.name) -ForegroundColor Green }
} catch {
  Write-Host ("  https://{0}" -f $dep.url) -ForegroundColor Green
}
Write-Host ''
Write-Host 'As fotos ficam no navegador de quem usa; nada e enviado para servidor.' -ForegroundColor Cyan
