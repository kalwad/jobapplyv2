# DIAGNOSTIC SCRATCH BRANCH ONLY - never merge.
# Windows PowerShell 5.1 on a hosted Windows Server runner (not Windows 11, not SYSTEM):
# parse the exact candidate bootstrap, guest and attestor body, then run the exact
# attestor body and the guest's own receipt and trace-retention code against real files.
param([Parameter(Mandatory=$true)][string]$Scripts,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$rows=New-Object Collections.ArrayList
function Row([string]$Name,[bool]$Ok,[string]$Detail) {
    [void]$rows.Add([ordered]@{check=$Name;pass=$Ok;detail=$Detail})
    Write-Host ((@('FAIL','PASS')[[int]$Ok])+' '+$Name+' :: '+$Detail)
}
$bootPath=Join-Path $Scripts 'windows11\windows11_bootstrap.ps1'
$guestPath=Join-Path $Scripts 'windows11\windows11_guest.ps1'
Row 'powershell-desktop-5.1' ($PSVersionTable.PSEdition -eq 'Desktop' -and $PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -eq 1) $PSVersionTable.PSVersion.ToString()
$os=Get-CimInstance Win32_OperatingSystem
Row 'host' $true ([string]$os.Caption+' '+[string]$os.BuildNumber)
$asts=@{}
foreach($p in @($bootPath,$guestPath)) {
    $t=$null; $e=$null
    $asts[$p]=[Management.Automation.Language.Parser]::ParseFile($p,[ref]$t,[ref]$e)
    Row ('parse '+(Split-Path -Leaf $p)) ($e.Count -eq 0) ((@($e|ForEach-Object {$_.ErrorId})) -join ',')
}
# The attestor is the single-quoted here-string the bootstrap assigns to $attestor.
$assign=$asts[$bootPath].Find({param($n) $n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -eq '$attestor'},$true)
$attestor=$assign.Right.Find({param($n) $n -is [Management.Automation.Language.StringConstantExpressionAst]},$true).Value
$t=$null; $e=$null
$attestorAst=[Management.Automation.Language.Parser]::ParseInput($attestor,[ref]$t,[ref]$e)
Row 'parse attestor body' ($e.Count -eq 0) ('chars='+$attestor.Length+' errors='+((@($e|ForEach-Object {$_.ErrorId})) -join ','))

# Run the exact attestor body as the task does, from a UTF-8 file written the same way.
$harness='C:\ProgramData\JappHarness'
if(Test-Path -LiteralPath $harness) { throw 'fresh harness required' }
New-Item -ItemType Directory -Path $harness | Out-Null
$nonce=-join ((1..64)|ForEach-Object {'0123456789abcdef'[(Get-Random -Maximum 16)]})
[ordered]@{nonce=$nonce}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $harness 'guest-config.json') -Encoding UTF8
'stale'|Set-Content -LiteralPath (Join-Path $harness 'machine-error.json') -Encoding UTF8
'stale-trace-line'|Set-Content -LiteralPath (Join-Path $harness 'attestor-trace.txt') -Encoding ASCII
$script=Join-Path $harness 'machine-attestor.ps1'
Set-Content -LiteralPath $script -Value $attestor -Encoding UTF8
$exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
function RunAttestor([string]$Label) {
    $watch=[Diagnostics.Stopwatch]::StartNew()
    $proc=Start-Process -FilePath $exe -ArgumentList @('-NoProfile','-ExecutionPolicy','RemoteSigned','-File',$script) -Wait -PassThru -NoNewWindow -RedirectStandardError (Join-Path $Out ($Label+'.stderr.txt')) -RedirectStandardOutput (Join-Path $Out ($Label+'.stdout.txt'))
    return @($proc.ExitCode,[Math]::Round($watch.Elapsed.TotalSeconds,2))
}
$run=RunAttestor 'attestor-run1'
Row 'attestor run exits non-zero off the fixture' ($run[0] -ne 0) ('exit='+$run[0]+' seconds='+$run[1])
$bootTime=$os.LastBootUpTime.ToUniversalTime().ToString('o')
$trace=[IO.File]::ReadAllText((Join-Path $harness 'attestor-trace.txt'))
Copy-Item -LiteralPath (Join-Path $harness 'attestor-trace.txt') -Destination (Join-Path $Out 'run1-attestor-trace.txt')
$lines=@($trace -split "`r`n" | Where-Object { $_ -ne '' })
$names=@($lines|ForEach-Object { $_.Substring($_.IndexOf(' ')+1) })
$stamps=@($lines|Where-Object { $_ -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z [a-z -]+$' })
Row 'trace is fresh, CRLF lines of UTC time and step' (-not $trace.Contains('stale') -and $stamps.Count -eq 0 -and $trace.EndsWith("`r`n")) ('lines='+$lines.Count+' bytes='+$trace.Length)
Row 'trace names each step to the failure' (($names -join '|') -ceq 'start|configuration|operating-system|interactive-user|caught at interactive-user') ($names -join '|')
$err=Get-Content -LiteralPath (Join-Path $harness 'machine-error.json') -Raw|ConvertFrom-Json
Copy-Item -LiteralPath (Join-Path $harness 'machine-error.json') -Destination (Join-Path $Out 'run1-machine-error.json')
Row 'error receipt is bound to this nonce and boot' ($err.schema -ceq 'japp-win11-protected-machine-error-v1' -and $err.step -ceq 'interactive-user' -and $err.nonce -ceq $nonce -and $err.boot_time -ceq $bootTime) ('step='+$err.step+' boot='+$err.boot_time+' expected='+$bootTime)
Row 'no machine.json on failure' (-not (Test-Path -LiteralPath (Join-Path $harness 'machine.json'))) ''

# The guest's shared read while the attestor appends: TraceStep from the attestor body.
$traceFn=$attestorAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'TraceStep'},$true)
$tracePath=Join-Path $Out 'shared-trace.txt'
. ([ScriptBlock]::Create($traceFn.Extent.Text))
TraceStep 'first'
$reader=[IO.File]::Open($tracePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
try {
    TraceStep 'appended-while-read-open'
    $buffer=New-Object byte[] 4096
    $count=$reader.Read($buffer,0,$buffer.Length)
    $seen=[Text.Encoding]::ASCII.GetString($buffer,0,$count)
} finally { $reader.Dispose() }
Row 'append succeeds while the guest reads' ($seen.Contains(' first') -and $seen.Contains(' appended-while-read-open')) ('read='+$count)
# A trace path that cannot be written never stops the attestor (TraceStep swallows).
$tracePath=Join-Path $Out 'missing-dir\trace.txt'
$swallowed=$true
try { TraceStep 'unwritable' } catch { $swallowed=$false }
Row 'unwritable trace is swallowed' ($swallowed -and -not (Test-Path -LiteralPath $tracePath)) ''

# A second run while a guest-mode reader holds the trace open: the run removes and recreates it.
$tracePath=Join-Path $harness 'attestor-trace.txt'
$holder=[IO.File]::Open($tracePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
try { $run=RunAttestor 'attestor-run2' } finally { $holder.Dispose() }
$trace2=if(Test-Path -LiteralPath $tracePath) { [IO.File]::ReadAllText($tracePath) } else { '' }
$names2=@(@($trace2 -split "`r`n" | Where-Object { $_ -ne '' })|ForEach-Object { $_.Substring($_.IndexOf(' ')+1) })
Row 'second run with a reader open still traces its own steps' (($names2 -join '|') -ceq 'start|configuration|operating-system|interactive-user|caught at interactive-user') ('exit='+$run[0]+' names='+($names2 -join '|'))

# The guest's ProtectedReceipt, defined from the guest's own source.
$receiptFn=$asts[$guestPath].Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'ProtectedReceipt'},$true)
. ([ScriptBlock]::Create($receiptFn.Extent.Text))
$probe=Join-Path $Out 'receipt.json'
Row 'receipt absent is null' ($null -eq (ProtectedReceipt $probe)) ''
'{"schema":'|Set-Content -LiteralPath $probe -Encoding UTF8 -NoNewline
Row 'receipt partial is null' ($null -eq (ProtectedReceipt $probe)) ''
'{"schema":"x"}'|Set-Content -LiteralPath $probe -Encoding UTF8
$value=ProtectedReceipt $probe
Row 'receipt whole is parsed' ($null -ne $value -and $value.schema -ceq 'x') ''
[IO.File]::WriteAllBytes($probe,(New-Object byte[] (64KB+1)))
$refused=$false
try { [void](ProtectedReceipt $probe) } catch { $refused=$_.Exception.Message -ceq 'Bounded protected machine receipt required' }
Row 'receipt over 64 KB is refused' $refused ''
Remove-Item -LiteralPath $probe

# The guest's trace retention block, run from the guest's own source text.
$guestText=[IO.File]::ReadAllText($guestPath)
$start=$guestText.IndexOf("    `$tracePath='C:\ProgramData\JappHarness\attestor-trace.txt'")
$end=$guestText.IndexOf('    $mismatch=@()')
$retain=[ScriptBlock]::Create($guestText.Substring($start,$end-$start))
function Retain([string]$Label) {
    $script:proof=Join-Path $Out ('proof-'+$Label)
    New-Item -ItemType Directory -Path $script:proof | Out-Null
    $proof=$script:proof
    try { . $retain; return 'ok' } catch { return $_.Exception.Message }
}
$expected=[IO.File]::ReadAllBytes($tracePath)
$result=Retain 'current'
$copy=Join-Path $Out 'proof-current\attestor-trace.txt'
Row 'retention copies the current trace exactly' ($result -ceq 'ok' -and (Test-Path -LiteralPath $copy) -and ([Convert]::ToBase64String([IO.File]::ReadAllBytes($copy)) -ceq [Convert]::ToBase64String($expected))) $result
[IO.File]::WriteAllBytes($tracePath,(New-Object byte[] (64KB+1)))
$result=Retain 'oversize'
Row 'retention refuses a trace over 64 KB' ($result -ceq 'Bounded protected attestor trace required' -and -not (Test-Path -LiteralPath (Join-Path $Out 'proof-oversize\attestor-trace.txt'))) $result
Remove-Item -LiteralPath $tracePath
$result=Retain 'absent'
Row 'retention without a trace writes nothing' ($result -ceq 'ok' -and @(Get-ChildItem -LiteralPath (Join-Path $Out 'proof-absent')).Count -eq 0) $result

$failed=@($rows|Where-Object { -not $_.pass })
[ordered]@{schema='diag36-attestor-primitives';host='hosted Windows Server runner, Windows PowerShell 5.1, administrator not SYSTEM, not Windows 11';rows=$rows;failed=$failed.Count}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $Out 'attestor-primitives.json') -Encoding UTF8
if($failed.Count -ne 0) { exit 1 }
