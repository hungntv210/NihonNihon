param([Parameter(Mandatory)][string]$ProjectPath,[Parameter(Mandatory)][string]$Destination,[string]$NodePath=(Get-Command node.exe -ErrorAction Stop).Source)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $ProjectPath
& $NodePath --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx tools/home-backup.ts copy $Destination
exit $LASTEXITCODE
