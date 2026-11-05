# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 14: does WebView2's TextPattern range for the "Desktop versions" region
# stay inside that region? Dump the scope text and the forward/backward matches
# for each policy anchor with the service Ready (Service version 0.0.1 visible).
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
function Rects($range) { @($range.GetBoundingRectangles()|ForEach-Object { @($_.X,$_.Y,$_.Width,$_.Height) }) }
Step 'region-and-scope' {
    $window=$app.Window()
    $doc=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Document))))[0]
    $pattern=[Windows.Automation.TextPattern]$doc.GetCurrentPattern([Windows.Automation.TextPattern]::Pattern)
    $regions=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::NameProperty,'Desktop versions'))))
    $rows=@()
    foreach($region in $regions) {
        $scope=$pattern.RangeFromChild($region)
        $text=$scope.GetText(4000)
        $row=@{type=$region.Current.ControlType.ProgrammaticName;scope_text=$text;scope_rects=(Rects $scope)}
        foreach($anchor in @('0.0.1','2.12.4','App version','Tauri version')) {
            $first=$scope.FindText($anchor,$false,$false); $last=$scope.FindText($anchor,$true,$false)
            $row[$anchor]=@{first=$(if($first){@{text=$first.GetText(20);rects=(Rects $first);element=$first.GetEnclosingElement().Current.Name}}else{$null});last=$(if($last){@{text=$last.GetText(20);rects=(Rects $last);element=$last.GetEnclosingElement().Current.Name}}else{$null});same=$(if($first -and $last){$first.Compare($last)}else{$null})}
        }
        $children=@($region.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::NameProperty,'0.0.1'))))|ForEach-Object { @{type=$_.Current.ControlType.ProgrammaticName;rect=@($_.Current.BoundingRectangle.X,$_.Current.BoundingRectangle.Y)} }
        $row['element_0.0.1_in_region']=$children
        $rows+=$row
    }
    $rows
}
Step 'shell-measure-current-driver' { $app.ShellMeasure('baseline') }
foreach($owner in $owners) { try { $owner.Dispose() } catch {} }
ProbeNote 'end' @{}
