param([Parameter(Mandatory)][string]$ProjectPath,[Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $ProjectPath
& (Get-Command node -ErrorAction Stop).Source --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx tools/home-backup.ts copy $Destination
exit $LASTEXITCODE
