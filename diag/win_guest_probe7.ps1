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
    try { Add-Type -AssemblyName System.Windows.Forms; $bounds=[Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap=New-Object Drawing.Bitmap $bounds.Width,$bounds.Height; $graphics=[Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($bounds.Location,[Drawing.Point]::Empty,$bounds.Size); $bitmap.Save((Join-Path $Out 'failure.png')); $graphics.Dispose(); $bitmap.Dispose() } catch {}
} finally {
    foreach($owner in $owners) { try { $owner.Dispose() } catch { ProbeNote 'dispose-error' @{message=$_.Exception.Message} } }
    if($null -ne $collision) { try { $collision.Stop() } catch {} }
}
