# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 20: at 175% zoom the Diagnostics content is below the fold. Which UIA call
# scrolls a WebView2 text element into view: the leaf range, the region range,
# or ScrollItemPattern on the leaf or region element?
param([Parameter(Mandatory=$true)][string]$Guest,[Parameter(Mandatory=$true)][string]$Cs,[Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$probeLog=New-Object Collections.ArrayList
function ProbeNote([string]$Key,$Value) { [void]$probeLog.Add([ordered]@{at=(Get-Date).ToString('o');key=$Key;value=$Value}); $probeLog|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8 }
function Step([string]$Key,[scriptblock]$Body) { try { ProbeNote $Key @{ok=$true;value=(& $Body)} } catch { ProbeNote $Key @{ok=$false;error=$_.Exception.GetType().FullName+': '+$_.Exception.Message} } }
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($Guest,[ref]$tokens,[ref]$errors)
foreach($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] },$false)) { . ([scriptblock]::Create($definition.Extent.Text)) }
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
Add-Type -TypeDefinition (Get-Content -LiteralPath $Cs -Raw) -ReferencedAssemblies $references
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$clock=[Diagnostics.Stopwatch]::StartNew()
$config=[pscustomobject]@{nonce=('a'*64);package_sha256=('b'*64)}
$owners=New-Object Collections.ArrayList
$packageRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('JobApply '+[char]0x03A9+' space '+$config.nonce.Substring(0,12))
Copy-Item -Recurse -LiteralPath $Package -Destination $packageRoot
$ignore=Join-Path $packageRoot 'runtime\.gitignore'; if(-not (Test-Path -LiteralPath $ignore)) { [IO.File]::WriteAllBytes($ignore,[Text.Encoding]::ASCII.GetBytes("*`n!.gitignore`n")) }
$app=Launch; Ready $app
$A=[Windows.Automation.AutomationElement]
function Parts {
    $window=$app.Window()
    $doc=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Document))))[0]
    $pattern=[Windows.Automation.TextPattern]$doc.GetCurrentPattern([Windows.Automation.TextPattern]::Pattern)
    $region=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition($A::NameProperty,'Desktop versions')),(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Group))))))[0]
    $leaf=@($region.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition($A::NameProperty,'0.0.1')),(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Text))))))[0]
    return @{pattern=$pattern;region=$region;leaf=$leaf}
}
function State { $p=Parts; @{offscreen=$p.leaf.Current.IsOffscreen;rect=@($p.leaf.Current.BoundingRectangle.Y,$p.leaf.Current.BoundingRectangle.Height);range_rects=@($p.pattern.RangeFromChild($p.leaf).GetBoundingRectangles()).Count;leaf_patterns=@($p.leaf.GetSupportedPatterns()|ForEach-Object { $_.ProgrammaticName });region_patterns=@($p.region.GetSupportedPatterns()|ForEach-Object { $_.ProgrammaticName })} }
function Top { $app.ShellFocusSkip(); $app.ShellKeys('enter'); Start-Sleep -Milliseconds 500; $app.ShellFocusRoute('Diagnostics'); Start-Sleep -Milliseconds 500 }
Step 'at-100' { State }
foreach($i in 1..4) { $app.ShellKeys('zoom'); Start-Sleep -Milliseconds 700 }
Step 'at-175-before' { State }
Step 'leaf-range-scroll' { $p=Parts; $p.pattern.RangeFromChild($p.leaf).ScrollIntoView($true); Start-Sleep -Milliseconds 700; State }
Top; Step 'reset-to-top' { State }
Step 'region-range-scroll' { $p=Parts; $p.pattern.RangeFromChild($p.region).ScrollIntoView($true); Start-Sleep -Milliseconds 700; State }
Top; Step 'reset-to-top-2' { State }
Step 'leaf-scrollitem' { $p=Parts; ([Windows.Automation.ScrollItemPattern]$p.leaf.GetCurrentPattern([Windows.Automation.ScrollItemPattern]::Pattern)).ScrollIntoView(); Start-Sleep -Milliseconds 700; State }
Top; Step 'reset-to-top-3' { State }
Step 'region-scrollitem' { $p=Parts; ([Windows.Automation.ScrollItemPattern]$p.region.GetCurrentPattern([Windows.Automation.ScrollItemPattern]::Pattern)).ScrollIntoView(); Start-Sleep -Milliseconds 700; State }
Step 'shell-measure-after' { $app.ShellMeasure('step4') }
foreach($owner in $owners) { try { $owner.Dispose() } catch {} }
ProbeNote 'end' @{}
