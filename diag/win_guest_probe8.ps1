# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 8: step-by-step measurement of the guest driver's functions and OwnedApp
# methods against the fixed development package (KI-0157 drive form, KI-0158
# Ctrl+Q forwarding), reaching Ready through the Diagnostics hyperlink.
param([Parameter(Mandatory=$true)][string]$Guest,[Parameter(Mandatory=$true)][string]$Cs,[Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$probeLog=New-Object Collections.ArrayList
function ProbeNote([string]$Key,$Value) { [void]$probeLog.Add([ordered]@{at=(Get-Date).ToString('o');key=$Key;value=$Value}); $probeLog|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8 }
function Step([string]$Key,[scriptblock]$Body) {
    $watch=[Diagnostics.Stopwatch]::StartNew()
    try { $value=& $Body; ProbeNote $Key @{ok=$true;ms=$watch.ElapsedMilliseconds;value=$value}; return $true }
    catch { ProbeNote $Key @{ok=$false;ms=$watch.ElapsedMilliseconds;error_type=$_.Exception.GetType().FullName;message=$_.Exception.Message;inner=$(if($_.Exception.InnerException){$_.Exception.InnerException.GetType().FullName+': '+$_.Exception.InnerException.Message}else{$null})}; return $false }
}
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($Guest,[ref]$tokens,[ref]$errors)
foreach($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] },$false)) { . ([scriptblock]::Create($definition.Extent.Text)) }
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
Add-Type -TypeDefinition (Get-Content -LiteralPath $Cs -Raw) -ReferencedAssemblies $references
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$clock=[Diagnostics.Stopwatch]::StartNew()
$proof=Join-Path $Out 'proof'; New-Item -ItemType Directory -Path $proof | Out-Null
$config=[pscustomobject]@{nonce=('a'*64);package_sha256=('b'*64)}
$owners=New-Object Collections.ArrayList
$packageRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('JobApply '+[char]0x03A9+' space '+$config.nonce.Substring(0,12))
Copy-Item -Recurse -LiteralPath $Package -Destination $packageRoot
$ignore=Join-Path $packageRoot 'runtime\.gitignore'
if(-not (Test-Path -LiteralPath $ignore)) { [IO.File]::WriteAllBytes($ignore,[Text.Encoding]::ASCII.GetBytes("*`n!.gitignore`n")) }
function OpenDiagnostics($App) {
    $condition=New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Diagnostics')),(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Hyperlink)))
    $deadline=$clock.Elapsed.TotalSeconds+20
    while($clock.Elapsed.TotalSeconds -lt $deadline) {
        try { $links=@($App.Window().FindAll([Windows.Automation.TreeScope]::Descendants,$condition)); if($links.Count -ge 1) { ([Windows.Automation.InvokePattern]$links[0].GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke(); return $links.Count } } catch {}
        Start-Sleep -Milliseconds 200
    }
    throw 'no Diagnostics hyperlink'
}
function ReadyNames($App) {
    $deadline=$clock.Elapsed.TotalSeconds+30
    while($clock.Elapsed.TotalSeconds -lt $deadline) {
        try { $names=@($App.Names()); if($names -contains 'Ready' -and ($names -join ' ') -match '0\.0\.1' -and ($names -join ' ') -match '1\.0\.0') { return ($names|Where-Object { $_ -match 'Ready|Check again|Checked at|[0-9]{4}-' }|Select-Object -Unique) } } catch {}
        Start-Sleep -Milliseconds 200
    }
    throw ('not Ready: '+((@($App.Names())|Select-Object -Unique) -join ' | '))
}
function Up([string]$Label) {
    $app=New-Object JobApplyValidation.OwnedApp; [void]$owners.Add($app)
    $app.Start((Join-Path $packageRoot 'desktop.exe'))
    [void](Step ($Label+'-diagnostics-link') { OpenDiagnostics $app })
    [void](Step ($Label+'-ready') { ReadyNames $app })
    return $app
}
$app=Up 'one'
$endpoint=$null
[void](Step 'endpoint' { $script:endpoint=Endpoint $app; $script:endpoint })
[void](Step 'diagnostics-candidates' { $condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Diagnostics'); @($app.Window().FindAll([Windows.Automation.TreeScope]::Descendants,$condition))|ForEach-Object { @{type=$_.Current.ControlType.ProgrammaticName;invoke=$_.GetSupportedPatterns().Contains([Windows.Automation.InvokePattern]::Pattern)} } })
[void](Step 'invoke-diagnostics-current-driver' { $app.Invoke('Diagnostics'); 'invoked' })
[void](Step 'unauthorized-guest-function' { Unauthorized $endpoint.port })
[void](Step 'unauthorized-raw-body' { Add-Type -AssemblyName System.Net.Http; $client=New-Object Net.Http.HttpClient; try { $client.GetAsync('http://127.0.0.1:'+$endpoint.port+'/api/v1/health').GetAwaiter().GetResult().Content.ReadAsStringAsync().GetAwaiter().GetResult() } finally { $client.Dispose() } })
[void](Step 'focus-timing' {
    $button=$app.Window().FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'Check again')))
    $before=[Windows.Automation.AutomationElement]::FocusedElement.Current.Name; $button.SetFocus(); $immediate=[Windows.Automation.AutomationElement]::FocusedElement.Current.Name
    $settled=$null; $w=[Diagnostics.Stopwatch]::StartNew(); while($w.ElapsedMilliseconds -lt 3000) { if([Windows.Automation.AutomationElement]::FocusedElement.Current.Name -ceq 'Check again'){$settled=$w.ElapsedMilliseconds;break}; Start-Sleep -Milliseconds 5 }
    @{before=$before;immediate=$immediate;settled_ms=$settled} })
$before=$null
[void](Step 'wait-checked-at' { $script:before=WaitCheckedAt $app; $script:before })
[void](Step 'keyboard-check-again' { $app.KeyboardCheckAgain(); 'sent' })
[void](Step 'checked-advance' { CheckedAdvance $app $before })
[void](Step 'route-home' { $app.ShellFocusRoute('Home'); $app.ShellKeys('enter'); ShellWait { $app.ShellRouteFocused('Home') }; 'focused' })
[void](Step 'route-back-diagnostics' { $app.ShellFocusRoute('Diagnostics'); $app.ShellKeys('enter'); ShellWait { $app.ShellRouteFocused('Diagnostics') }; 'focused' })
[void](Step 'close-window' { $app.CloseWindow(); 'requested' })
[void](Step 'closed-guest-function' { Closed $app $endpoint.port; 'drained and released' })
$app=Up 'two'
[void](Step 'endpoint-two' { $script:endpoint=Endpoint $app; $script:endpoint })
[void](Step 'menu-expand-file' { $app.Expand('File'); 'expanded' })
[void](Step 'menu-invoke-popup-quit' { $app.InvokePopupItem('Quit'); 'invoked' })
[void](Step 'menu-closed' { Closed $app $endpoint.port; 'drained and released' })
$app=Up 'three'
[void](Step 'endpoint-three' { $script:endpoint=Endpoint $app; $script:endpoint })
[void](Step 'ctrl-q' { $owner=$app.FocusOwner(); $app.KeyboardQuit(); @{focus_owner=$owner;drained=$app.WaitEmpty(6000)} })
[void](Step 'ctrl-q-closed' { Closed $app $endpoint.port; 'drained and released' })
$app=Up 'four'
[void](Step 'endpoint-four' { $script:endpoint=Endpoint $app; $script:endpoint })
[void](Step 'kill-root' { $app.KillRoot(); 'killed' })
[void](Step 'kill-root-closed' { Closed $app $endpoint.port; 'drained and released' })
foreach($owner in $owners) { try { $owner.Dispose() } catch {} }
ProbeNote 'end' @{elapsed_s=[Math]::Round($clock.Elapsed.TotalSeconds,2)}
