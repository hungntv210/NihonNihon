param([Parameter(Mandatory)][string]$ProjectPath)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $ProjectPath
$logDirectory=Join-Path $ProjectPath 'data/reports/home'
New-Item -ItemType Directory -Force $logDirectory|Out-Null
& (Get-Command node -ErrorAction Stop).Source 'node_modules/next/dist/bin/next' start --hostname 127.0.0.1 --port 3000 *> (Join-Path $logDirectory 'app.log')
exit $LASTEXITCODE
