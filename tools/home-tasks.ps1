[CmdletBinding(SupportsShouldProcess)]
param([string]$ProjectPath='C:\Users\Admin\NihonNihon',[string]$Destination='D:\NihonNihonBackup',[switch]$Apply)
$ErrorActionPreference='Stop'
$project=[IO.Path]::GetFullPath($ProjectPath)
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershell=(Get-Command powershell.exe -ErrorAction Stop).Source
$node=(Get-Command node.exe -ErrorAction Stop).Source
$appScript=Join-Path $project 'tools/home-run.ps1'
$copyScript=Join-Path $project 'tools/home-copy-backup.ps1'
$appArguments="-NoProfile -NonInteractive -WindowStyle Hidden -File `"$appScript`" -ProjectPath `"$project`" -NodePath `"$node`""
$copyArguments="-NoProfile -NonInteractive -WindowStyle Hidden -File `"$copyScript`" -ProjectPath `"$project`" -Destination `"$Destination`" -NodePath `"$node`""
if(!$Apply){@{mode='PLAN_ONLY';user=$user;project=$project;destination=$Destination;appTask='NihonNihon-App';appArguments=$appArguments;backupTask='NihonNihon-Backup';backupArguments=$copyArguments;trigger='App: startup; Backup: daily23:30';logonType='S4U';runLevel='Limited';restart='3 attempts, 1 minute apart'}|ConvertTo-Json;return}
foreach($file in @($appScript,$copyScript,(Join-Path $project '.next/BUILD_ID'),(Join-Path $project '.env.local'))){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw "Missing prerequisite: $file"}}
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
if($PSCmdlet.ShouldProcess('NihonNihon-App','Register startup/restart task')){
 Register-ScheduledTask -TaskName 'NihonNihon-App' -Action (New-ScheduledTaskAction -Execute $powershell -Argument $appArguments -WorkingDirectory $project) -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -Principal $principal|Out-Null
}
if($PSCmdlet.ShouldProcess('NihonNihon-Backup','Register daily copy and verification task')){
 Register-ScheduledTask -TaskName 'NihonNihon-Backup' -Action (New-ScheduledTaskAction -Execute $powershell -Argument $copyArguments -WorkingDirectory $project) -Trigger (New-ScheduledTaskTrigger -Daily -At '23:30') -Settings $settings -Principal $principal|Out-Null
}
