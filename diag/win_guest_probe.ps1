# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 4: on a hosted Windows runner, compile the guest driver (windows11_owned.cs)
# exactly as windows11_guest.ps1 does and exercise the reviewed portable package
# the way the guest would, recording each audit finding's actual behaviour:
# the %TEMP% image identity, Ready/Check again, the 401 body, SetFocus timing,
# the File menu popup location, File->Quit, Ctrl+Q and refused-connect timing.
# Every step is caught and recorded; nothing here is campaign evidence.
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
        Note ('shot-'+$Name) @{ok=$true}
    } catch { Note ('shot-'+$Name) @{ok=$false;message=$_.Exception.Message} }
}

Note 'facts' @{user=[Environment]::UserName;interactive=[Environment]::UserInteractive;session=(Get-Process -Id $PID).SessionId;temp=$env:TEMP;temp_long=(Get-Item -LiteralPath $env:TEMP).FullName;localappdata=[Environment]::GetFolderPath('LocalApplicationData');ps=$PSVersionTable.PSVersion.ToString();clr=[Environment]::Version.ToString();os=(Get-CimInstance Win32_OperatingSystem).Caption;build=[Environment]::OSVersion.Version.ToString();explorer=@(Get-Process explorer -ErrorAction SilentlyContinue).Count;screen=[Windows.Forms.SystemInformation]::PrimaryMonitorSize.ToString();webview2=(Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue).pv}

$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
Step 'compile-owned-cs' { Add-Type -TypeDefinition (Get-Content -LiteralPath $Cs -Raw) -ReferencedAssemblies $references; 'compiled' }
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# The guest's own package root: Join-Path $env:TEMP with a Unicode/spaces name.
$packageRoot=Join-Path $env:TEMP ('JobApply '+[char]0x03A9+' space probe')
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($Zip,$packageRoot)
$desktop=Join-Path $packageRoot 'desktop.exe'
$service=Join-Path $packageRoot 'runtime\japp-orchestrator\japp-orchestrator.exe'
Note 'package' @{root=$packageRoot;root_long=(Get-Item -LiteralPath $packageRoot).FullName;service_exists=(Test-Path -LiteralPath $service)}

function Names($App) { try { return @($App.Names()) } catch { return @('<error '+$_.Exception.GetType().Name+': '+$_.Exception.Message+'>') } }
function WaitReady($App,[string]$Label) {
    # Observation only: invoke Diagnostics once; never press Check again here.
    $clicked=$false; $seen=@{}; $deadline=$clock.Elapsed.TotalSeconds+60
    while($clock.Elapsed.TotalSeconds -lt $deadline) {
        $names=Names $App
        $key=($names|Where-Object { $_ -match 'Ready|Checking|Check again|Diagnostics|Unavailable|error' }|Select-Object -Unique) -join ' | '
        if(-not $seen.ContainsKey($key)) { $seen[$key]=$true; Note ($Label+'-names') @{names=$key} }
        if(-not $clicked -and $names -contains 'Diagnostics') { try { $App.Invoke('Diagnostics'); $clicked=$true; Note ($Label+'-diagnostics-invoked') @{} } catch { Note ($Label+'-diagnostics-invoke-error') @{message=$_.Exception.Message} } }
        if($names -contains 'Ready' -and ($names -join ' ') -match '0\.0\.1' -and ($names -join ' ') -match '1\.0\.0') { Note ($Label+'-ready') @{} ; return $true }
        Start-Sleep -Milliseconds 250
    }
    Note ($Label+'-ready-timeout') @{names=(Names $App) -join ' | '}
    return $false
}
function Port($App) {
    foreach($member in @($App.Members())) {
        $listeners=@(Get-NetTCPConnection -OwningProcess $member -State Listen -ErrorAction SilentlyContinue)
        if($listeners.Count -ge 1) { return [int]$listeners[0].LocalPort }
    }
    return 0
}

$app=New-Object JobApplyValidation.OwnedApp
Step 'launch-1' { $app.Start($desktop); $app.Pid }
$ready=WaitReady $app 'launch-1'
Shot 'ready-1'
Step 'image-identity' {
    $rows=@()
    foreach($member in @($app.Members())) {
        $image=$app.MemberImage($member)
        $rows+=@{pid=$member;image=$image;equals_temp_join=($image -ieq $service);long_equals=($image -ieq (Get-Item -LiteralPath $service).FullName)}
    }
    $rows
}
$port=Port $app
Note 'service-port' @{port=$port}
Step 'unauthorized-body' {
    Add-Type -AssemblyName System.Net.Http
    $client=New-Object Net.Http.HttpClient
    try {
        $response=$client.GetAsync('http://127.0.0.1:'+$port+'/api/v1/health').GetAwaiter().GetResult()
        $body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        @{status=[int]$response.StatusCode;body=$body.Substring(0,[Math]::Min(2000,$body.Length))}
    } finally { $client.Dispose() }
}
Step 'focus-timing' {
    $window=$app.Window()
    $button=$window.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Check again')))
    if($null -eq $button) { throw 'no Check again button' }
    $before=[Windows.Automation.AutomationElement]::FocusedElement.Current.Name
    $button.SetFocus()
    $immediate=[Windows.Automation.AutomationElement]::FocusedElement.Current.Name
    $settledAt=$null; $watch=[Diagnostics.Stopwatch]::StartNew()
    while($watch.ElapsedMilliseconds -lt 3000) { if([Windows.Automation.AutomationElement]::FocusedElement.Current.Name -ceq 'Check again') { $settledAt=$watch.ElapsedMilliseconds; break }; Start-Sleep -Milliseconds 10 }
    @{before=$before;immediately_after=$immediate;settled_ms=$settledAt}
}
Step 'keyboard-check-again-head' { $app.KeyboardCheckAgain(); 'sent' }
Start-Sleep -Seconds 2
Step 'menu-expand-file' { $app.Expand('File'); 'expanded' }
Start-Sleep -Milliseconds 500
Shot 'menu-open'
Step 'menu-quit-under-window' {
    $quit=$app.Window().FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Quit')))
    if($null -eq $quit) { 'absent' } else { @{pid=$quit.Current.ProcessId;type=$quit.Current.ControlType.ProgrammaticName} }
}
$members=@($app.Members())
Step 'menu-quit-under-desktop' {
    $root=[Windows.Automation.AutomationElement]::RootElement
    $menus=@($root.FindAll([Windows.Automation.TreeScope]::Children,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Menu))))
    $rows=@()
    foreach($menu in $menus) {
        $quit=$menu.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Quit')))
        $rows+=@{menu_name=$menu.Current.Name;pid=$menu.Current.ProcessId;owned=($members -contains [uint32]$menu.Current.ProcessId);class=$menu.Current.ClassName;has_quit=($null -ne $quit)}
    }
    $rows
}
Step 'menu-quit-invoke-desktop-popup' {
    $root=[Windows.Automation.AutomationElement]::RootElement
    $menus=@($root.FindAll([Windows.Automation.TreeScope]::Children,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Menu))))
    $target=$null
    foreach($menu in $menus) { if($members -contains [uint32]$menu.Current.ProcessId) { $target=$menu.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Quit'))) } }
    if($null -eq $target) { throw 'no owned popup Quit' }
    ([Windows.Automation.InvokePattern]$target.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
    'invoked'
}
Step 'menu-quit-drain' { $app.WaitEmpty(10000) }
Step 'released-timing-1' {
    $socket=New-Object Net.Sockets.Socket([Net.Sockets.AddressFamily]::InterNetwork,[Net.Sockets.SocketType]::Stream,[Net.Sockets.ProtocolType]::Tcp)
    try {
        $watch=[Diagnostics.Stopwatch]::StartNew()
        $pending=$socket.BeginConnect([Net.IPAddress]::Loopback,$port,$null,$null)
        $done=$pending.AsyncWaitHandle.WaitOne(8000)
        $elapsed=$watch.ElapsedMilliseconds
        $code=$null
        try { $socket.EndConnect($pending); $code='CONNECTED' } catch [Net.Sockets.SocketException] { $code=$_.Exception.SocketErrorCode.ToString() } catch { $code=$_.Exception.GetType().Name }
        @{completed=$done;elapsed_ms=$elapsed;code=$code}
    } finally { $socket.Dispose() }
}
try { $app.Dispose() } catch { Note 'dispose-1' @{message=$_.Exception.Message} }

$app=New-Object JobApplyValidation.OwnedApp
Step 'launch-2' { $app.Start($desktop); $app.Pid }
$ready=WaitReady $app 'launch-2'
$port=Port $app
Step 'ctrl-q-head' { $app.KeyboardQuit(); 'sent' }
Step 'ctrl-q-drain' { $app.WaitEmpty(10000) }
Shot 'after-ctrl-q'
Step 'ctrl-q-members-left' { @($app.Members()).Count }
Step 'close-window-fallback' { if(@($app.Members()).Count -gt 0) { $app.CloseWindow(); $app.WaitEmpty(10000) } else { 'not needed' } }
try { $app.Dispose() } catch { Note 'dispose-2' @{message=$_.Exception.Message} }

# Ctrl+Q after giving keyboard focus to the WebView content explicitly (click into the page via UIA focus).
$app=New-Object JobApplyValidation.OwnedApp
Step 'launch-3' { $app.Start($desktop); $app.Pid }
$ready=WaitReady $app 'launch-3'
Step 'focus-webview-then-ctrl-q' {
    $window=$app.Window()
    $link=$window.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Home')))
    if($null -ne $link) { $link.SetFocus(); Start-Sleep -Milliseconds 500 }
    $focused=[Windows.Automation.AutomationElement]::FocusedElement
    $app.KeyboardQuit()
    @{focused_before=$focused.Current.Name;focused_pid=$focused.Current.ProcessId;focused_class=$focused.Current.ClassName;drained=$app.WaitEmpty(10000)}
}
Step 'close-window-fallback-3' { if(@($app.Members()).Count -gt 0) { $app.CloseWindow(); $app.WaitEmpty(10000) } else { 'not needed' } }
try { $app.Dispose() } catch { Note 'dispose-3' @{message=$_.Exception.Message} }
Note 'end' @{}
