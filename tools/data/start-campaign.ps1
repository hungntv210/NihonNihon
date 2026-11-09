[CmdletBinding()]
param(
 [Parameter(Mandatory)][string]$ProjectPath,
 [Parameter(Mandatory)][string]$ConfigPath,
 [Parameter(Mandatory)][string]$EnvFile,
 [string]$NodePath=(Get-Command node.exe -ErrorAction Stop).Source,
 [DateTimeOffset]$NotBefore=[DateTimeOffset]::Now,
 [switch]$Plan
)
$ErrorActionPreference='Stop'
$project=[IO.Path]::GetFullPath($ProjectPath)
function Resolve-TaskPath([string]$Value){if([IO.Path]::IsPathRooted($Value)){return [IO.Path]::GetFullPath($Value)};return [IO.Path]::GetFullPath((Join-Path $project $Value))}
$configFile=Resolve-TaskPath $ConfigPath
$envPath=Resolve-TaskPath $EnvFile
$node=Resolve-TaskPath $NodePath
$scriptFile=Join-Path $project 'tools/data/translation-campaign.mjs'
foreach($file in @($configFile,$envPath,$node,$scriptFile)){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw "Missing prerequisite: $file"}}
$config=Get-Content -LiteralPath $configFile -Raw|ConvertFrom-Json
$stateDirectory=Resolve-TaskPath $config.directory
$database=Resolve-TaskPath $config.import.dbPath
$hash=[Security.Cryptography.SHA256]::Create()
try{$identity=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($database.ToLowerInvariant())))).Replace('-','')}finally{$hash.Dispose()}
if($Plan){@{mode='PLAN_ONLY';project=$project;config=$configFile;node=$node;notBefore=$NotBefore.ToString('o');mutex='Global\NihonNihon-G0-'+$identity;registersTask=$false}|ConvertTo-Json;return}
$mutex=[Threading.Mutex]::new($false,('Global\NihonNihon-G0-'+$identity));$owned=$false
try{
 try{$owned=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owned=$true}
 if(!$owned){'Already running or waiting for quota reset';return}
 New-Item -ItemType Directory -Force -Path $stateDirectory|Out-Null
 $launcherState=Join-Path $stateDirectory 'launcher-state.json'
 function Save-Launcher([string]$Phase,$WorkerId=$null,$Code=$null){
  $json=@{launcherPid=$PID;workerPid=$WorkerId;phase=$Phase;notBefore=$NotBefore.ToString('o');config=$configFile;updatedAt=[DateTimeOffset]::Now.ToString('o');exitCode=$Code}|ConvertTo-Json
  $temporary=$launcherState+".$PID.tmp"
  [IO.File]::WriteAllText($temporary,$json,[Text.UTF8Encoding]::new($false))
  for($attempt=0;$attempt -lt 20;$attempt++){try{if([IO.File]::Exists($launcherState)){[IO.File]::Replace($temporary,$launcherState,[NullString]::Value)}else{[IO.File]::Move($temporary,$launcherState)};return}catch [IO.IOException]{if($attempt -eq 19){throw};Start-Sleep -Milliseconds 50}}
 }
 function Test-ExistingWorker{
  $lockFile=Join-Path $stateDirectory 'campaign.lock'
  if(Test-Path -LiteralPath $lockFile){
   $lock=Get-Content -LiteralPath $lockFile -Raw|ConvertFrom-Json
   $lockPid=[int]$lock.pid;if($lockPid -le 0){throw 'Invalid campaign lock PID'}
   $owner=Get-CimInstance Win32_Process -Filter "ProcessId = $lockPid"
   if($owner){if($owner.Name -eq 'node.exe' -and $owner.CommandLine -match 'translation-campaign\.mjs' -and $owner.CommandLine.Contains([IO.Path]::GetFileName($configFile))){return $true};throw 'Lock PID is alive but not the expected worker; lock retained'}
   Remove-Item -LiteralPath $lockFile
   @{at=[DateTimeOffset]::Now.ToString('o');file=$lockFile;verifiedDeadPid=$lockPid;reason='stale_campaign_lock'}|ConvertTo-Json -Compress|Add-Content -LiteralPath (Join-Path $stateDirectory 'launcher-deletions.jsonl')
  }
  $workers=@(Get-CimInstance Win32_Process|Where-Object {$_.Name -eq 'node.exe' -and $_.CommandLine -match 'translation-campaign\.mjs'})
  return $workers.Count -gt 0
 }
 if(Test-ExistingWorker){'An existing campaign worker was found; no second worker started';return}
 while([DateTimeOffset]::Now -lt $NotBefore){Save-Launcher 'waiting_for_reset';Start-Sleep -Milliseconds ([int][Math]::Min(30000,[Math]::Max(1,($NotBefore-[DateTimeOffset]::Now).TotalMilliseconds)))}
 if(Test-ExistingWorker){'An existing campaign worker was found; no second worker started';return}
 $stamp=[DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss-fff')
 $arguments=@("--env-file=`"$envPath`"","`"$scriptFile`"",'--config',"`"$configFile`"")
 $worker=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDirectory "worker-$stamp.stdout.log") -RedirectStandardError (Join-Path $stateDirectory "worker-$stamp.stderr.log") -PassThru
 Save-Launcher 'running' $worker.Id
 $worker.WaitForExit();$worker.Refresh();$result=$worker.ExitCode;Save-Launcher 'exited' $worker.Id $result;exit $result
}finally{if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
