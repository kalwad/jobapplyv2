# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 11: open File with the guest driver's own Expand, then find the Win32
# popup by window class and read it with UI Automation from its handle.
param([Parameter(Mandatory=$true)][string]$Cs,[Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$probeLog=New-Object Collections.ArrayList
function ProbeNote([string]$Key,$Value) { [void]$probeLog.Add([ordered]@{at=(Get-Date).ToString('o');key=$Key;value=$Value}); $probeLog|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8 }
function Step([string]$Key,[scriptblock]$Body) { $w=[Diagnostics.Stopwatch]::StartNew(); try { $v=& $Body; ProbeNote $Key @{ok=$true;ms=$w.ElapsedMilliseconds;value=$v} } catch { ProbeNote $Key @{ok=$false;ms=$w.ElapsedMilliseconds;error=$_.Exception.GetType().FullName+': '+$_.Exception.Message;inner=$(if($_.Exception.InnerException){$_.Exception.InnerException.Message}else{$null})} } }
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
Add-Type -TypeDefinition (Get-Content -LiteralPath $Cs -Raw) -ReferencedAssemblies $references
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class JappWin { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h); }'
$A=[Windows.Automation.AutomationElement]
function Describe($e) { if($null -eq $e){return $null}; @{name=$e.Current.Name;type=$e.Current.ControlType.ProgrammaticName;class=$e.Current.ClassName;pid=$e.Current.ProcessId;enabled=$e.Current.IsEnabled;patterns=@($e.GetSupportedPatterns()|ForEach-Object { $_.ProgrammaticName })} }
function Popups($Pid0) {
    $rows=@(); $h=[IntPtr]::Zero
    do { $h=[JappWin]::FindWindowEx([IntPtr]::Zero,$h,'#32768',$null); if($h -ne [IntPtr]::Zero) { $owner=0; [void][JappWin]::GetWindowThreadProcessId($h,[ref]$owner); $e=$A::FromHandle($h); $rows+=@{hwnd=[long]$h;visible=[JappWin]::IsWindowVisible($h);owner_pid=$owner;owned=($owner -eq $Pid0);element=(Describe $e);items=@($e.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)|ForEach-Object { Describe $_ })} } } while($h -ne [IntPtr]::Zero)
    return $rows
}
$root='C:\japp-menu-probe'
Copy-Item -Recurse -LiteralPath $Package -Destination $root
$ignore=Join-Path $root 'runtime\.gitignore'; if(-not (Test-Path -LiteralPath $ignore)) { [IO.File]::WriteAllBytes($ignore,[Text.Encoding]::ASCII.GetBytes("*`n!.gitignore`n")) }
$app=New-Object JobApplyValidation.OwnedApp
$app.Start((Join-Path $root 'desktop.exe'))
Start-Sleep -Seconds 10
Step 'window' { $w=$app.Window(); @{window=(Describe $w);children=@($w.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition)|ForEach-Object { Describe $_ });file=(Describe ($w.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::NameProperty,'File')))))} }
Step 'popups-before' { Popups ([uint32]$app.Pid) }
Step 'expand-file' { $app.Expand('File'); 'expanded' }
foreach($delay in 100,400,1000) { Start-Sleep -Milliseconds $delay; Step ('popups-after-'+$delay) { Popups ([uint32]$app.Pid) } }
Step 'invoke-quit-from-owned-popup' {
    $h=[IntPtr]::Zero; $quit=$null
    do { $h=[JappWin]::FindWindowEx([IntPtr]::Zero,$h,'#32768',$null); if($h -ne [IntPtr]::Zero) { $owner=0; [void][JappWin]::GetWindowThreadProcessId($h,[ref]$owner); if($owner -eq $app.Pid -and [JappWin]::IsWindowVisible($h)) { $quit=$A::FromHandle($h).FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::NameProperty,'Quit'))) } } } while($h -ne [IntPtr]::Zero -and $null -eq $quit)
    if($null -eq $quit) { throw 'no owned visible #32768 Quit' }
    $d=Describe $quit
    ([Windows.Automation.InvokePattern]$quit.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
    @{item=$d;drained=$app.WaitEmpty(10000)} }
try { $app.Dispose() } catch {}
ProbeNote 'end' @{}
