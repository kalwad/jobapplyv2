# DIAGNOSTIC SCRATCH ONLY - never merge. Runs in place of windows11_guest.ps1 as the
# synthetic fixture at logon (the real bootstrap's Startup entry). It only observes:
# the SYSTEM attestor task, its receipts and the harness ACL, written to COM2.
param([string]$Configuration)
$ErrorActionPreference='Continue'
$port=New-Object System.IO.Ports.SerialPort('COM2',115200,'None',8,'One'); $port.NewLine="`n"; $port.Open()
function Emit([string]$k,$v){ try { $port.WriteLine('JDIAG '+(([ordered]@{t=(Get-Date).ToUniversalTime().ToString('o');k=$k;v=$v})|ConvertTo-Json -Compress -Depth 6)) } catch {} }
$os=Get-CimInstance Win32_OperatingSystem
Emit 'start' @{user=$env:USERNAME;boot=$os.LastBootUpTime.ToUniversalTime().ToString('o');uptime_s=[int]((Get-Date)-$os.LastBootUpTime).TotalSeconds}
$h='C:\ProgramData\JappHarness'
$seen=0
for($i=0;$i -lt 60;$i++){
  $m=Test-Path "$h\machine.json"; $e=Test-Path "$h\machine-error.json"
  $info=$null; $infoErr=$null
  try { $info=Get-ScheduledTaskInfo -TaskName 'JappOwnedMachineAttestation' -ErrorAction Stop } catch { $infoErr=$_.Exception.Message }
  $row=@{i=$i;machine=$m;error=$e;info_error=$infoErr}
  if($info){ $row.last_run=$info.LastRunTime.ToUniversalTime().ToString('o'); $row.last_result=('0x{0:X}' -f $info.LastTaskResult); $row.missed=$info.NumberOfMissedRuns }
  Emit 'poll' $row
  if(Test-Path "$h\attestor-trace.txt"){ Emit 'trace' @(Get-Content "$h\attestor-trace.txt") }
  if($m){ try { Emit 'machine' (Get-Content "$h\machine.json" -Raw) } catch { Emit 'machine_read_error' $_.Exception.Message } }
  if($e){ try { Emit 'machine_error' (Get-Content "$h\machine-error.json" -Raw) } catch { Emit 'error_read_error' $_.Exception.Message } }
  if($m -or $e){ $seen++; if($seen -ge 3){ break } }
  Start-Sleep -Seconds 5
}
try { Emit 'acl' @((Get-Acl $h).Access | ForEach-Object { $_.IdentityReference.Value+':'+$_.FileSystemRights+':'+$_.AccessControlType }) } catch { Emit 'acl_error' $_.Exception.Message }
try { Emit 'files' @(Get-ChildItem $h | ForEach-Object { $_.Name+':'+$_.Length+':'+$_.LastWriteTimeUtc.ToString('o') }) } catch { Emit 'files_error' $_.Exception.Message }
try { $t=Get-ScheduledTask -TaskName 'JappOwnedMachineAttestation' -ErrorAction Stop; Emit 'task' @{state=[string]$t.State;user=$t.Principal.UserId;limit=$t.Settings.ExecutionTimeLimit;triggers=@($t.Triggers|ForEach-Object{$_.CimClass.CimClassName})} } catch { Emit 'task_error' $_.Exception.Message }
try { $ev=@(Get-WinEvent -LogName 'Microsoft-Windows-TaskScheduler/Operational' -MaxEvents 400 -ErrorAction Stop | Where-Object { $_.Message -match 'JappOwned' } | Select-Object -First 30 | ForEach-Object { $msg=($_.Message -replace '\s+',' '); $_.TimeCreated.ToUniversalTime().ToString('o')+' '+$_.Id+' '+$msg.Substring(0,[Math]::Min(220,$msg.Length)) }); Emit 'task_events' $ev } catch { Emit 'task_events_error' $_.Exception.Message }
try { Emit 'registered_xml' (Get-Content "$h\task-registered.xml" -Raw) } catch { Emit 'registered_xml_error' $_.Exception.Message }
try { Emit 'bootstrap_trace' @(Get-Content "$h\bootstrap-trace.txt") } catch { Emit 'bootstrap_trace_error' $_.Exception.Message }
try { Emit 'schtasks' (& schtasks.exe /query /tn JappOwnedMachineAttestation /v /fo LIST 2>&1 | Out-String) } catch { Emit 'schtasks_error' $_.Exception.Message }
Emit 'end' @{}
$port.Close()
