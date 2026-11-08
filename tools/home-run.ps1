param([Parameter(Mandatory)][string]$ProjectPath,[string]$NodePath=(Get-Command node.exe -ErrorAction Stop).Source)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $ProjectPath
$logDirectory=Join-Path $ProjectPath 'data/reports/home'
New-Item -ItemType Directory -Force $logDirectory|Out-Null
& $NodePath 'node_modules/next/dist/bin/next' start --hostname 127.0.0.1 --port 3000 *>> (Join-Path $logDirectory 'app.log')
exit $LASTEXITCODE
