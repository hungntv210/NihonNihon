param([Parameter(Mandatory)][string]$ProjectPath,[string]$NodePath=(Get-Command node.exe -ErrorAction Stop).Source,[ValidateRange(1,65535)][int]$Port=3000)
$ErrorActionPreference='Stop'
if(!('NihonHomeProcessJob' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'home-process-job.cs')}
[NihonHomeProcessJob]::ProtectLauncher()
Set-Location -LiteralPath $ProjectPath
$logDirectory=Join-Path $ProjectPath 'data/reports/home'
New-Item -ItemType Directory -Force $logDirectory|Out-Null
# Windows PowerShell5.1 wraps native stderr as ErrorRecords; warnings must not kill the app.
$ErrorActionPreference='Continue'
& $NodePath 'node_modules/next/dist/bin/next' start --hostname 127.0.0.1 --port $Port *>> (Join-Path $logDirectory 'app.log')
exit $LASTEXITCODE
