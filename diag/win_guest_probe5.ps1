# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 5: why does the packaged local service fail when the guest driver
# launches the reviewed package (round 4 window title "Local service failed")?
# Launch desktop.exe from four locations, with and without the guest driver's
# job owner, watch whether japp-orchestrator.exe starts and its exit code, and,
# for the first launch that reaches a running service, measure the remaining
# audit findings (Diagnostics link, SetFocus timing, 401 body, File menu popup,
# File->Quit, Ctrl+Q, refused-connect timing).
param([Parameter(Mandatory=$true)][string]$Zip,[Parameter(Mandatory=$true)][string]$Cs,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$clock=[Diagnostics.Stopwatch]::StartNew()
$log=New-Object Collections.ArrayList
New-Item -ItemType Directory -Force -Path $Out | Out-Null
function Note([string]$Key,$Value) {
    [void]$log.Add([ordered]@{t=[Math]::Round($clock.Elapsed.TotalSeconds,3);key=$Key;value=$Value})
    $log|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8
}
function Step([string]$Key,[scriptblock]$Body) {
    try { $value=& $Body; Note $Key @{ok=$true;value=$value} }
    catch { Note $Key @{ok=$false;error_type=$_.Exception.GetType().FullName;message=$_.Exception.Message;inner=$(if($_.Exception.InnerException){$_.Exception.InnerException.GetType().FullName+': '+$_.Exception.InnerException.Message}else{$null})} }
}
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
function Shot([string]$Name) {
    try {
        $bounds=[Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap=New-Object Drawing.Bitmap $bounds.Width,$bounds.Height
        $graphics=[Drawing.Graphics]::FromImage($bitmap)
        try { $graphics.CopyFromScreen($bounds.Location,[Drawing.Point]::Empty,$bounds.Size); $bitmap.Save((Join-Path $Out ($Name+'.png'))) } finally { $graphics.Dispose(); $bitmap.Dispose() }
    } catch { Note ('shot-'+$Name) @{ok=$false;message=$_.Exception.Message} }
}
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
Add-Type -TypeDefinition (Get-Content -LiteralPath $Cs -Raw) -ReferencedAssemblies $references
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Net.Http

function TopTitle([int]$ProcessId) {
    $root=[Windows.Automation.AutomationElement]::RootElement
    $condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty,$ProcessId)
    $window=$root.FindFirst([Windows.Automation.TreeScope]::Children,$condition)
    if($null -eq $window){return $null}
    return $window.Current.Name
}
function Watch([int]$RootPid,[int]$Seconds,[string]$Label) {
    $deadline=$clock.Elapsed.TotalSeconds+$Seconds; $titles=@{}; $services=@{}
    while($clock.Elapsed.TotalSeconds -lt $deadline) {
        try { $title=TopTitle $RootPid } catch { $title='<uia error>' }
        if($null -ne $title -and -not $titles.ContainsKey($title)) { $titles[$title]=$true; Note ($Label+'-title') @{title=$title} }
        foreach($process in @(Get-Process -Name 'japp-orchestrator' -ErrorAction SilentlyContinue)) {
            if(-not $services.ContainsKey($process.Id)) { $null=$process.Handle; $services[$process.Id]=$process; Note ($Label+'-service-started') @{pid=$process.Id;path=$process.Path} }
        }
        foreach($id in @($services.Keys)) { $process=$services[$id]; if($process.HasExited -and -not $process.PSObject.Properties['noted']) { Note ($Label+'-service-exited') @{pid=$id;exit_code=$process.ExitCode}; $process|Add-Member -NotePropertyName noted -NotePropertyValue $true } }
        if($title -ceq 'Desktop App') { return $true }
        if($title -like '*failed*' -and $clock.Elapsed.TotalSeconds -gt $deadline-$Seconds+15) { return $false }
        Start-Sleep -Milliseconds 200
    }
    return $false
}
function StopAll { foreach($name in @('desktop','japp-orchestrator')) { Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2 }

Note 'facts' @{user=[Environment]::UserName;temp=$env:TEMP;localappdata=[Environment]::GetFolderPath('LocalApplicationData')}
$roots=[ordered]@{
    ascii='C:\japp-probe-ascii'
    unicode_long=(Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('JobApply '+[char]0x03A9+' space probe'))
    temp_short=(Join-Path $env:TEMP ('JobApply '+[char]0x03A9+' space temp'))
}
foreach($key in $roots.Keys) { [IO.Compression.ZipFile]::ExtractToDirectory($Zip,$roots[$key]); Note ('extracted-'+$key) @{root=$roots[$key];long=(Get-Item -LiteralPath $roots[$key]).FullName} }

$running=$null
foreach($variant in @(@('ascii','direct'),@('unicode_long','direct'),@('unicode_long','job'),@('temp_short','job'),@('ascii','job'))) {
    $key=$variant[0]; $mode=$variant[1]; $label=$key+'-'+$mode
    $desktop=Join-Path $roots[$key] 'desktop.exe'
    if($mode -ceq 'direct') { $process=Start-Process -FilePath $desktop -WorkingDirectory $roots[$key] -PassThru; $rootPid=$process.Id; $app=$null }
    else { $app=New-Object JobApplyValidation.OwnedApp; $app.Start($desktop); $rootPid=[int]$app.Pid }
    $ok=Watch $rootPid 45 $label
    Shot $label
    Note ($label+'-result') @{running=$ok}
    if($ok -and $null -eq $running -and $mode -ceq 'job') { $running=@{key=$key;app=$app;pid=$rootPid}; break }
    if($null -ne $app) { try { $app.Dispose() } catch {} }
    StopAll
}
foreach($dir in @((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'dev.jobapply.desktop'),(Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'dev.jobapply.desktop'))) {
    if(Test-Path -LiteralPath $dir) { Note 'app-data' @{dir=$dir;files=@(Get-ChildItem -LiteralPath $dir -Recurse -File -ErrorAction SilentlyContinue|ForEach-Object { $_.FullName+' '+$_.Length })} }
}
if($null -eq $running) { Note 'no-running-job-variant' @{}; return }

$app=$running.app
function Port { foreach($member in @($app.Members())) { $listeners=@(Get-NetTCPConnection -OwningProcess $member -State Listen -ErrorAction SilentlyContinue); if($listeners.Count -ge 1){return [int]$listeners[0].LocalPort} }; return 0 }
$port=Port
Note 'service-port' @{port=$port}
Step 'image-identity' { @($app.Members())|ForEach-Object { @{pid=$_;image=$app.MemberImage($_)} } }
Step 'unauthorized-body' { $client=New-Object Net.Http.HttpClient; try { $response=$client.GetAsync('http://127.0.0.1:'+$port+'/api/v1/health').GetAwaiter().GetResult(); @{status=[int]$response.StatusCode;body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()} } finally { $client.Dispose() } }
Step 'diagnostics-candidates' {
    $condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Diagnostics')
    @($app.Window().FindAll([Windows.Automation.TreeScope]::Descendants,$condition))|ForEach-Object { $patterns=@($_.GetSupportedPatterns()|ForEach-Object { $_.ProgrammaticName }); @{type=$_.Current.ControlType.ProgrammaticName;patterns=$patterns} }
}
Step 'diagnostics-open' {
    $condition=New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Diagnostics')),(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Hyperlink)))
    $link=$app.Window().FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
    ([Windows.Automation.InvokePattern]$link.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
    Start-Sleep -Seconds 3
    @($app.Names()|Where-Object { $_ -match 'Ready|Check again|Checked at|[0-9]{4}-[0-9]{2}' }|Select-Object -Unique)
}
Shot 'diagnostics'
Step 'focus-timing' {
    $button=$app.Window().FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Check again')))
    $before=[Windows.Automation.AutomationElement]::FocusedElement.Current.Name
    $button.SetFocus()
    $immediate=[Windows.Automation.AutomationElement]::FocusedElement.Current.Name
    $settled=$null; $watch=[Diagnostics.Stopwatch]::StartNew()
    while($watch.ElapsedMilliseconds -lt 3000) { if([Windows.Automation.AutomationElement]::FocusedElement.Current.Name -ceq 'Check again'){$settled=$watch.ElapsedMilliseconds;break}; Start-Sleep -Milliseconds 5 }
    @{before=$before;immediate=$immediate;settled_ms=$settled}
}
Step 'keyboard-check-again-head' { $app.KeyboardCheckAgain(); 'sent' }
Start-Sleep -Seconds 2
Step 'ctrl-q' {
    $focused=[Windows.Automation.AutomationElement]::FocusedElement
    $app.KeyboardQuit()
    @{focused=$focused.Current.Name;focused_pid=$focused.Current.ProcessId;drained=$app.WaitEmpty(10000);members=@($app.Members()).Count}
}
Shot 'after-ctrl-q'
if(@($app.Members()).Count -gt 0) {
    Step 'menu-expand' { $app.Expand('File'); 'expanded' }
    Start-Sleep -Milliseconds 700
    Shot 'menu-open'
    $members=@($app.Members())
    Step 'menu-desktop-children' {
        $root=[Windows.Automation.AutomationElement]::RootElement
        @($root.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition))|Where-Object { $members -contains [uint32]$_.Current.ProcessId }|ForEach-Object { @{name=$_.Current.Name;type=$_.Current.ControlType.ProgrammaticName;class=$_.Current.ClassName;pid=$_.Current.ProcessId} }
    }
    Step 'menu-quit-invoke' {
        $root=[Windows.Automation.AutomationElement]::RootElement
        $quit=$null
        foreach($top in @($root.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition))) {
            if($members -contains [uint32]$top.Current.ProcessId -and $top.Current.ClassName -ceq '#32768') { $quit=$top.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Quit'))) }
        }
        if($null -eq $quit) { throw 'no owned #32768 Quit item' }
        ([Windows.Automation.InvokePattern]$quit.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
        @{drained=$app.WaitEmpty(10000)}
    }
}
Step 'released-timing' {
    $socket=New-Object Net.Sockets.Socket([Net.Sockets.AddressFamily]::InterNetwork,[Net.Sockets.SocketType]::Stream,[Net.Sockets.ProtocolType]::Tcp)
    try { $watch=[Diagnostics.Stopwatch]::StartNew(); $pending=$socket.BeginConnect([Net.IPAddress]::Loopback,$port,$null,$null); $done=$pending.AsyncWaitHandle.WaitOne(8000); $elapsed=$watch.ElapsedMilliseconds; $code=$null; try { $socket.EndConnect($pending); $code='CONNECTED' } catch [Net.Sockets.SocketException] { $code=$_.Exception.SocketErrorCode.ToString() }; @{completed=$done;elapsed_ms=$elapsed;code=$code} } finally { $socket.Dispose() }
}
try { $app.Dispose() } catch {}
StopAll
Note 'end' @{}
