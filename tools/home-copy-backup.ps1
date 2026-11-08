param([Parameter(Mandatory)][string]$ProjectPath,[Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $ProjectPath
& (Get-Command npm.cmd -ErrorAction Stop).Source run backup:daily
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& (Get-Command node -ErrorAction Stop).Source --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx tools/home-backup.ts copy $Destination
exit $LASTEXITCODE
