[CmdletBinding(SupportsShouldProcess)]
param([string]$ProjectPath='C:\Users\Admin\NihonNihon',[string]$Destination='D:\NihonNihonBackup',[switch]$Apply)
$ErrorActionPreference='Stop'
$project=[IO.Path]::GetFullPath($ProjectPath)
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershell=(Get-Command powershell.exe -ErrorAction Stop).Source
$appScript=Join-Path $project 'tools/home-run.ps1'
$copyScript=Join-Path $project 'tools/home-copy-backup.ps1'
$appArguments="-NoProfile -NonInteractive -WindowStyle Hidden -File `"$appScript`" -ProjectPath `"$project`""
$copyArguments="-NoProfile -NonInteractive -WindowStyle Hidden -File `"$copyScript`" -ProjectPath `"$project`" -Destination `"$Destination`""
if(!$Apply){@{mode='PLAN_ONLY';user=$user;project=$project;destination=$Destination;appTask='NihonNihon-App';appArguments=$appArguments;backupTask='NihonNihon-Backup';backupArguments=$copyArguments;trigger='App: user logon; Backup: daily22:00 and logon';restart='3 attempts, 1 minute apart'}|ConvertTo-Json;return}
foreach($file in @($appScript,$copyScript,(Join-Path $project '.next/BUILD_ID'),(Join-Path $project '.env.local'))){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw "Missing prerequisite: $file"}}
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
if($PSCmdlet.ShouldProcess('NihonNihon-App','Register logon/restart task')){
 Register-ScheduledTask -TaskName 'NihonNihon-App' -Action (New-ScheduledTaskAction -Execute $powershell -Argument $appArguments -WorkingDirectory $project) -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $user) -Settings $settings -Principal $principal|Out-Null
}
if($PSCmdlet.ShouldProcess('NihonNihon-Backup','Register daily/logon copy and verification task')){
 Register-ScheduledTask -TaskName 'NihonNihon-Backup' -Action (New-ScheduledTaskAction -Execute $powershell -Argument $copyArguments -WorkingDirectory $project) -Trigger @((New-ScheduledTaskTrigger -Daily -At '22:00'),(New-ScheduledTaskTrigger -AtLogOn -User $user)) -Settings $settings -Principal $principal|Out-Null
}
