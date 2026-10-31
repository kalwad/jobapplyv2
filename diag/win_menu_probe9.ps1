# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 9: how does UI Automation expose the product's open Win32 File popup?
param([Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$probeLog=New-Object Collections.ArrayList
function ProbeNote([string]$Key,$Value) { [void]$probeLog.Add([ordered]@{at=(Get-Date).ToString('o');key=$Key;value=$Value}); $probeLog|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8 }
function Step([string]$Key,[scriptblock]$Body) { $w=[Diagnostics.Stopwatch]::StartNew(); try { $v=& $Body; ProbeNote $Key @{ok=$true;ms=$w.ElapsedMilliseconds;value=$v} } catch { ProbeNote $Key @{ok=$false;ms=$w.ElapsedMilliseconds;error=$_.Exception.GetType().FullName+': '+$_.Exception.Message} } }
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; public static class JappWin { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h); [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }'
$root='C:\japp-menu-probe'
Copy-Item -Recurse -LiteralPath $Package -Destination $root
$ignore=Join-Path $root 'runtime\.gitignore'; if(-not (Test-Path -LiteralPath $ignore)) { [IO.File]::WriteAllBytes($ignore,[Text.Encoding]::ASCII.GetBytes("*`n!.gitignore`n")) }
$process=Start-Process -FilePath (Join-Path $root 'desktop.exe') -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 10
$A=[Windows.Automation.AutomationElement]
function Describe($e) { if($null -eq $e){return $null}; @{name=$e.Current.Name;type=$e.Current.ControlType.ProgrammaticName;class=$e.Current.ClassName;pid=$e.Current.ProcessId;hwnd=$e.Current.NativeWindowHandle;patterns=@($e.GetSupportedPatterns()|ForEach-Object { $_.ProgrammaticName })} }
$window=$A::RootElement.FindFirst([Windows.Automation.TreeScope]::Children,(New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty,$process.Id)))
[void][JappWin]::SetForegroundWindow([IntPtr]$window.Current.NativeWindowHandle)
Step 'menubars' { @($window.FindAll([Windows.Automation.TreeScope]::Children,(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::MenuBar))))|ForEach-Object { Describe $_ } }
$file=$null
Step 'file-item' { $script:file=$window.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition($A::NameProperty,'File')),(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::MenuItem))))); Describe $script:file }
Step 'expand-file' { ([Windows.Automation.ExpandCollapsePattern]$file.GetCurrentPattern([Windows.Automation.ExpandCollapsePattern]::Pattern)).Expand(); 'expanded' }
Start-Sleep -Milliseconds 700
Step 'file-children-after-expand' { @($file.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition))|ForEach-Object { Describe $_ } }
Step 'file-descendants-after-expand' { @($file.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition))|ForEach-Object { Describe $_ } }
Step 'win32-popups' {
    $rows=@(); $h=[IntPtr]::Zero
    do { $h=[JappWin]::FindWindowEx([IntPtr]::Zero,$h,'#32768',$null); if($h -ne [IntPtr]::Zero) { $pid0=0; [void][JappWin]::GetWindowThreadProcessId($h,[ref]$pid0); $e=$A::FromHandle($h); $items=@($e.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)|ForEach-Object { Describe $_ }); $rows+=@{hwnd=[long]$h;visible=[JappWin]::IsWindowVisible($h);owner_pid=$pid0;element=(Describe $e);items=$items} } } while($h -ne [IntPtr]::Zero)
    $rows }
Step 'root-children' { @($A::RootElement.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition))|ForEach-Object { Describe $_ } }
Step 'invoke-quit-via-popup-hwnd' {
    $h=[IntPtr]::Zero; $target=$null
    do { $h=[JappWin]::FindWindowEx([IntPtr]::Zero,$h,'#32768',$null); if($h -ne [IntPtr]::Zero -and [JappWin]::IsWindowVisible($h)) { $pid0=0; [void][JappWin]::GetWindowThreadProcessId($h,[ref]$pid0); if($pid0 -eq $process.Id) { $target=$A::FromHandle($h).FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::NameProperty,'Quit'))) } } } while($h -ne [IntPtr]::Zero -and $null -eq $target)
    if($null -eq $target) { throw 'no visible owned #32768 Quit' }
    $d=Describe $target
    ([Windows.Automation.InvokePattern]$target.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
    $exited=$process.WaitForExit(10000)
    @{item=$d;exited=$exited} }
if(-not $process.HasExited) { Stop-Process -Id $process.Id -Force; Get-Process -Name japp-orchestrator -ErrorAction SilentlyContinue | Stop-Process -Force }
ProbeNote 'end' @{}
