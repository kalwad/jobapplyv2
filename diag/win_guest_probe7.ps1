# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 7: run the guest driver's OWN lifecycle phase code (sliced verbatim from
# windows11_guest.ps1, $phase='ready' .. terminal PASS, with all its functions
# loaded through the PowerShell parser) against the fixed development package
# on a hosted Windows Server 2025 desktop. Only the VM-only environment phase,
# the serial receipts and the host frame acknowledgements are replaced.
param([Parameter(Mandatory=$true)][string]$Guest,[Parameter(Mandatory=$true)][string]$Cs,[Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$probeLog=New-Object Collections.ArrayList
function ProbeNote([string]$Key,$Value) { [void]$probeLog.Add([ordered]@{at=(Get-Date).ToString('o');key=$Key;value=$Value}); $probeLog|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8 }
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($Guest,[ref]$tokens,[ref]$errors)
ProbeNote 'parse' @{errors=@($errors|ForEach-Object { $_.Message+' @'+$_.Extent.StartLineNumber })}
foreach($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] },$false)) { . ([scriptblock]::Create($definition.Extent.Text)) }
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
Add-Type -TypeDefinition (Get-Content -LiteralPath $Cs -Raw) -ReferencedAssemblies $references
Add-Type -AssemblyName System.Drawing
# Probe-only replacements: no serial protocol or host on this runner.
function Receipt([string]$Name,[hashtable]$Details) { ProbeNote ('receipt-'+$Name) @{elapsed_s=[Math]::Round($clock.Elapsed.TotalSeconds,2);details=$Details} }
function HostAccepted([string]$Expected,[int]$Milliseconds,[string]$Refusal) { }
$clock=[Diagnostics.Stopwatch]::StartNew()
$proof=Join-Path $Out 'proof'; New-Item -ItemType Directory -Path $proof | Out-Null
$config=[pscustomobject]@{nonce=('a'*64);package_sha256=('b'*64)}
$rows=New-Object Collections.ArrayList
$owners=New-Object Collections.ArrayList
$framedPhases=@('ready','keyboard','restart','relaunch','collision')
$collision=$null;$serviceHandle=$null;$terminal=$null;$phase='setup'
$packageRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('JobApply '+[char]0x03A9+' space '+$config.nonce.Substring(0,12))
Copy-Item -Recurse -LiteralPath $Package -Destination $packageRoot
# upload-artifact drops hidden files; restore the manifest-listed runtime/.gitignore
# with its exact bytes and check them against the package's own build manifest.
$ignore=Join-Path $packageRoot 'runtime\.gitignore'
if(-not (Test-Path -LiteralPath $ignore)) { [IO.File]::WriteAllBytes($ignore,[Text.Encoding]::ASCII.GetBytes("*`n!.gitignore`n")) }
$build=Get-Content -LiteralPath (Join-Path $packageRoot 'build-manifest.json') -Raw|ConvertFrom-Json
$expected=$build.files.'runtime/.gitignore'.sha256
$actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $ignore).Hash.ToLowerInvariant()
if($actual -cne $expected) { throw ('restored .gitignore differs: '+$actual+' vs '+$expected) }
ProbeNote 'package' @{root=$packageRoot;files=@(Get-ChildItem -LiteralPath $packageRoot -File -Recurse).Count}
$text=[IO.File]::ReadAllText($Guest)
$start=$text.IndexOf("    `$phase='ready'; `$app=Launch")
$end=$text.IndexOf("    `$terminal=[ordered]@{terminal='PASS'")
if($start -lt 0 -or $end -lt $start) { throw 'guest phase markers not found' }
$body=$text.Substring($start,$end-$start)
ProbeNote 'phase-body' @{bytes=$body.Length;sha256=([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($body)))).Replace('-','')}
try {
    . ([scriptblock]::Create($body))
    ProbeNote 'terminal' @{terminal='PASS';elapsed_s=[Math]::Round($clock.Elapsed.TotalSeconds,2)}
} catch {
    $failure=@{terminal='FAIL';phase=$phase;elapsed_s=[Math]::Round($clock.Elapsed.TotalSeconds,2);error_type=$_.Exception.GetType().FullName;message=$_.Exception.Message;inner=$(if($_.Exception.InnerException){$_.Exception.InnerException.GetType().FullName+': '+$_.Exception.InnerException.Message}else{$null});position=$_.InvocationInfo.PositionMessage}
    ProbeNote 'terminal' $failure
    try {
        $A=[Windows.Automation.AutomationElement]
        $window=$app.Window()
        $doc=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Document))))[0]
        $pattern=[Windows.Automation.TextPattern]$doc.GetCurrentPattern([Windows.Automation.TextPattern]::Pattern)
        $region=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition($A::NameProperty,'Desktop versions')),(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Group))))))
        $rows=@{regions=$region.Count;document_rect=@($doc.Current.BoundingRectangle.X,$doc.Current.BoundingRectangle.Y,$doc.Current.BoundingRectangle.Width,$doc.Current.BoundingRectangle.Height)}
        if($region.Count -ge 1) { foreach($label in @('App version','0.0.1','2.12.4')) {
            $leaves=@($region[0].FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition($A::NameProperty,$label)),(New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty,[Windows.Automation.ControlType]::Text))))))
            $row=@{leaves=$leaves.Count}
            if($leaves.Count -ge 1) { $scope=$pattern.RangeFromChild($leaves[0]); $first=$scope.FindText($label,$false,$false); $row.leaf_rect=@($leaves[0].Current.BoundingRectangle.X,$leaves[0].Current.BoundingRectangle.Y,$leaves[0].Current.BoundingRectangle.Width,$leaves[0].Current.BoundingRectangle.Height); $row.offscreen=$leaves[0].Current.IsOffscreen; $row.scope_rects=@($scope.GetBoundingRectangles()|ForEach-Object { @($_.X,$_.Y,$_.Width,$_.Height) }); $row.first_rects=$(if($first){@($first.GetBoundingRectangles()|ForEach-Object { @($_.X,$_.Y,$_.Width,$_.Height) })}else{'none'}) }
            $rows[$label]=$row } }
        ProbeNote 'anchors-at-failure' $rows
    } catch { ProbeNote 'anchors-at-failure-error' @{message=$_.Exception.Message} }
    try { Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; $f=[Windows.Automation.AutomationElement]::FocusedElement; ProbeNote 'focus-at-failure' @{name=$f.Current.Name;type=$f.Current.ControlType.ProgrammaticName;pid=$f.Current.ProcessId;main_focused=$(try{$app.ShellMainFocused()}catch{$_.Exception.Message});names=@($app.Names()|Where-Object { $_ -match 'Skip|main|Checked|Ready|Local service' }|Select-Object -Unique)} } catch { ProbeNote 'focus-at-failure-error' @{message=$_.Exception.Message} }
    try { Add-Type -AssemblyName System.Windows.Forms; $bounds=[Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap=New-Object Drawing.Bitmap $bounds.Width,$bounds.Height; $graphics=[Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($bounds.Location,[Drawing.Point]::Empty,$bounds.Size); $bitmap.Save((Join-Path $Out 'failure.png')); $graphics.Dispose(); $bitmap.Dispose() } catch {}
} finally {
    foreach($owner in $owners) { try { $owner.Dispose() } catch { ProbeNote 'dispose-error' @{message=$_.Exception.Message} } }
    if($null -ne $collision) { try { $collision.Stop() } catch {} }
}
