param([Parameter(Mandatory=$true)][string]$Configuration)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$clock = [Diagnostics.Stopwatch]::StartNew()
$budgetSeconds = 900 # DIAG: measure the phases without the budget as the cause
$script:diagLastNames = '' # DIAG
# The protocol port opens before anything else can fail, so a preflight failure
# reaches the host as one terminal row instead of at the host's work deadline.
$serial = New-Object IO.Ports.SerialPort('COM2',115200,'None',8,'One')
$serial.WriteTimeout = 30000
$serial.Open()
$config = $null
function ConfigPin([string]$Name) {
    # Only an exact 64-hex identity of the parsed configuration is echoed.
    if ($null -eq $config) { return $null }
    $property = $config.PSObject.Properties[$Name]
    if ($null -eq $property -or $property.Value -isnot [string] -or $property.Value -cnotmatch '^[0-9a-f]{64}$') { return $null }
    return $property.Value
}
function BoundedMessage([Exception]$Exception) { return $Exception.Message.Substring(0,[Math]::Min(512,$Exception.Message.Length)) }
try {
    $config = Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
    if ($config.schema -ne 'japp-win11-guest-config-v1' -or $config.nonce -cnotmatch '^[0-9a-f]{64}$' -or $config.package_sha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'Closed guest configuration required' }
    $resultDisk = @([IO.DriveInfo]::GetDrives() | Where-Object { $_.VolumeLabel -eq 'JAPP-RESULT' })
    if ($resultDisk.Count -ne 1) { throw 'Exactly one fresh owned result disk required' }
    $proof = Join-Path $resultDisk[0].RootDirectory.FullName 'proof'
    if (Test-Path -LiteralPath $proof) { throw 'Fresh proof namespace required' }
    New-Item -ItemType Directory -Path $proof | Out-Null
} catch {
    $failure=[ordered]@{terminal='FAIL';phase='preflight';nonce=(ConfigPin 'nonce');package_sha256=(ConfigPin 'package_sha256');error_type=$_.Exception.GetType().FullName;message=(BoundedMessage $_.Exception)}
    try { $serial.WriteLine('JAPP11 '+($failure|ConvertTo-Json -Depth 4 -Compress)) } finally { $serial.Close(); $serial.Dispose() }
    exit 1
}
$rows = New-Object Collections.ArrayList
$owners = New-Object Collections.ArrayList
$terminal=$null
$phase = 'environment'
$packageRoot = $null
$collision = $null
$serviceHandle = $null
# The Linux owner answers each of these receipts after its own QMP frame, and the
# guest's next action changes the UI, so the guest waits for that answer first.
$framedPhases = @('ready','keyboard','restart','relaunch','collision')
function HostAccepted([string]$Expected,[int]$Milliseconds,[string]$Refusal) {
    # One exact nonce-bound host line on the protocol port, within a fixed bound.
    $serial.ReadTimeout=$Milliseconds
    try { $line=$serial.ReadLine() } catch [TimeoutException] { throw ($Refusal+' within '+$Milliseconds+' ms') }
    if($line -cne $Expected) { throw $Refusal }
}
function Receipt([string]$Name, [hashtable]$Details) {
    $row = [ordered]@{phase=$Name;status='PASS';nonce=$config.nonce;package_sha256=$config.package_sha256;elapsed_ms=[long]$clock.ElapsedMilliseconds}
    foreach ($key in $Details.Keys) { $row[$key]=$Details[$key] }
    [void]$rows.Add($row)
    $line = $row | ConvertTo-Json -Depth 10 -Compress
    if ($line.Length -gt 65536) { throw 'Bounded phase receipt required' }
    Add-Content -LiteralPath (Join-Path $proof 'receipts.ndjson') -Value $line -Encoding UTF8
    $diagWrite=[Diagnostics.Stopwatch]::StartNew()
    $serial.WriteLine('JAPP11 '+$line)
    $diagWrite.Stop(); Add-Content -LiteralPath (Join-Path $proof 'diag-serial-writes.txt') -Value ($Name+' chars='+$line.Length+' write_ms='+$diagWrite.ElapsedMilliseconds+' at_ms='+$clock.ElapsedMilliseconds) -Encoding ASCII
    if($framedPhases -ccontains $Name) { HostAccepted ('JAPP11-FRAME-ACCEPT '+$Name+' '+$config.nonce) 60000 ('Host did not accept the actual '+$Name+' frame') }
}
function DiagServiceCold {
    # DIAG round 43: the packaged service's own cold start outside the desktop, spawn to
    # its first READY-frame bytes, with the desktop's framed bootstrap on stdin.
    $row=[ordered]@{}
    $p=$null
    try {
        $exe=Join-Path $packageRoot 'runtime\japp-orchestrator\japp-orchestrator.exe'
        $l=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0); $l.Start(); $port=$l.LocalEndpoint.Port; $l.Stop()
        $alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; $hex='0123456789abcdef'; $rng=New-Object Random
        $inst='svc_'+(-join (1..26|ForEach-Object { $alphabet[$rng.Next(32)] }))
        $secret=-join (1..64|ForEach-Object { $hex[$rng.Next(16)] })
        $json=[ordered]@{protocol='JAPP_SERVICE_BOOTSTRAP_V1';schema_version='1.0.0';bind_host='127.0.0.1';bind_port=$port;session_token=$secret;instance_id=$inst;generation=1}|ConvertTo-Json -Compress
        $body=[Text.Encoding]::UTF8.GetBytes($json)
        $len=[BitConverter]::GetBytes([uint32]$body.Length); [Array]::Reverse($len)
        $psi=New-Object Diagnostics.ProcessStartInfo($exe); $psi.UseShellExecute=$false; $psi.RedirectStandardInput=$true; $psi.RedirectStandardOutput=$true; $psi.WorkingDirectory=(Split-Path $exe); $psi.CreateNoWindow=$true
        $watch=[Diagnostics.Stopwatch]::StartNew()
        $p=[Diagnostics.Process]::Start($psi)
        $row.spawn_ms=$watch.ElapsedMilliseconds
        $in=$p.StandardInput.BaseStream; $in.Write($len,0,4); $in.Write($body,0,$body.Length); $in.Flush()
        $buf=New-Object byte[] 4096
        $task=$p.StandardOutput.BaseStream.ReadAsync($buf,0,4096)
        if($task.Wait(120000)) { $got=$task.Result; $row.first_bytes_ms=$watch.ElapsedMilliseconds; $row.bytes=$got; if($got -gt 4) { $row.frame=[Text.Encoding]::UTF8.GetString($buf,4,$got-4) } } else { $row.first_bytes_ms=-1 }
        $row.exited=$p.HasExited
    } catch { $row.error=$_.Exception.GetType().FullName+': '+$_.Exception.Message }
    finally { if($null -ne $p) { try { if(-not $p.HasExited) { $p.Kill(); [void]$p.WaitForExit(10000) } } catch { } } }
    $row|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $proof 'diag-service-cold.json') -Encoding UTF8
}
function DiagMark([string]$Stage) {
    # DIAG only: where the guest was when the VM rebooted (round 40).
    try { [IO.File]::AppendAllText((Join-Path $proof 'diag-progress.txt'),($Stage+' at_ms='+$clock.ElapsedMilliseconds+"`r`n")) } catch { }
}
function DiagShell([string]$Stage) {
    # DIAG only: the first-logon shell state this rehearsal measures (KI-0177/KI-0179).
    try {
        $desktop=Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop' -ErrorAction SilentlyContinue
        $advanced=Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -ErrorAction SilentlyContinue
        $video=(& powercfg.exe /query SCHEME_CURRENT SUB_VIDEO VIDEOIDLE) -join ' | '
        $row=[ordered]@{stage=$Stage;at_ms=$clock.ElapsedMilliseconds;registry_foreground_lock=$(if($null -ne $desktop -and $desktop.PSObject.Properties['ForegroundLockTimeout']){[string]$desktop.ForegroundLockTimeout}else{'absent'});registry_start_shown=$(if($null -ne $advanced -and $advanced.PSObject.Properties['StartShownOnUpgrade']){[string]$advanced.StartShownOnUpgrade}else{'absent'});spi_foreground_lock=[string][JobApplyValidation.OwnedApp]::ForegroundLockTimeoutValue();foreground=[JobApplyValidation.OwnedApp]::ForegroundProcessName();video=$video.Substring(0,[Math]::Min(1500,$video.Length))}
        Add-Content -LiteralPath (Join-Path $proof 'diag-shell-state.ndjson') -Value ($row|ConvertTo-Json -Compress) -Encoding UTF8
    } catch { Add-Content -LiteralPath (Join-Path $proof 'diag-shell-state.ndjson') -Value ('{"stage":"'+$Stage+'","error":"'+$_.Exception.GetType().FullName+'"}') -Encoding UTF8 }
}
function DiagDx {
    # DIAG only: why dxdiag /x leaves no file in the Windows 11 VM (round 38).
    $rows=New-Object Collections.ArrayList
    $dir=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'JappDxProbe'
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $started=Get-Date
    foreach($probe in @(@{name='x-long';args=@('/whql:off','/x',(Join-Path $dir 'p1.xml'));out=(Join-Path $dir 'p1.xml')},@{name='t-long';args=@('/whql:off','/t',(Join-Path $dir 'p2.txt'));out=(Join-Path $dir 'p2.txt')},@{name='x-temp-noflag';args=@('/x',(Join-Path $env:TEMP 'p3.xml'));out=(Join-Path $env:TEMP 'p3.xml')})) {
        $watch=[Diagnostics.Stopwatch]::StartNew(); $seen=New-Object Collections.ArrayList; $titles=New-Object Collections.ArrayList
        try {
            $p=Start-Process -FilePath 'C:\Windows\System32\dxdiag.exe' -ArgumentList $probe.args -PassThru
            while(-not $p.HasExited -and $watch.Elapsed.TotalSeconds -lt 90) {
                foreach($q in @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'dxdiag|dxgi|dxcpl|WerFault' })) { $k=[string]$q.Id+':'+$q.ProcessName; if(-not $seen.Contains($k)) { [void]$seen.Add($k) }; if($q.MainWindowTitle -and -not $titles.Contains($q.MainWindowTitle)) { [void]$titles.Add($q.MainWindowTitle) } }
                Start-Sleep -Milliseconds 200
            }
            $exited=$p.HasExited; $code=$(if($exited){[string]$p.ExitCode}else{'running'}); $processMs=$watch.ElapsedMilliseconds
            if(-not $exited) { try { $p.Kill() } catch { } }
            while($watch.Elapsed.TotalSeconds -lt 120 -and -not (Test-Path -LiteralPath $probe.out)) { Start-Sleep -Milliseconds 500 }
            $size=$(if(Test-Path -LiteralPath $probe.out){(Get-Item -LiteralPath $probe.out).Length}else{-1})
            [void]$rows.Add([ordered]@{probe=$probe.name;exited=$exited;exit_code=$code;process_ms=$processMs;file_bytes=$size;file_wait_ms=$watch.ElapsedMilliseconds;seen=@($seen);titles=@($titles)})
        } catch { [void]$rows.Add([ordered]@{probe=$probe.name;error=$_.Exception.GetType().FullName;message=[string]$_.Exception.Message}) }
    }
    $events=@()
    try { $events=@(Get-WinEvent -FilterHashtable @{LogName='Application';StartTime=$started.AddMinutes(-1)} -MaxEvents 300 -ErrorAction Stop | Where-Object { $_.Message -match 'dxdiag' -or $_.ProviderName -match 'Application Error|Windows Error Reporting|Application Hang' } | Select-Object -First 10 | ForEach-Object { $m=[string]$_.Message; [ordered]@{provider=$_.ProviderName;id=$_.Id;time=$_.TimeCreated.ToUniversalTime().ToString('o');message=$m.Substring(0,[Math]::Min(700,$m.Length))} }) } catch { $events=@(@{error=$_.Exception.GetType().FullName}) }
    [ordered]@{probes=@($rows);events=@($events);temp=$env:TEMP}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $proof 'diag-dxdiag.json') -Encoding UTF8
}
function WithinBudget { if ($clock.Elapsed.TotalSeconds -ge $budgetSeconds) { throw 'Guest work deadline exceeded' } }
function NotYet([Management.Automation.ErrorRecord]$Record) {
    # A WebView2/UIA tree that is still changing is 'not yet', never a pass: every
    # caller keeps polling within its bound and asserts strictly at its deadline.
    $exception=$Record.Exception
    if(($exception -is [Management.Automation.MethodInvocationException] -or $exception -is [Management.Automation.GetValueInvocationException]) -and $null -ne $exception.InnerException) { $exception=$exception.InnerException }
    # The owner's own ownership, uniqueness and bound assertions, and a disposed
    # owner, are never 'not yet': they fail at once with their exact cause.
    if($exception.GetType().FullName -ceq 'JobApplyValidation.OwnedInvariantException' -or $exception -is [ObjectDisposedException]) { return $false }
    return ($exception -is [InvalidOperationException] -or $exception -is [Runtime.InteropServices.COMException] -or $exception.GetType().FullName -ceq 'System.Windows.Automation.ElementNotAvailableException')
}
function LastTransient([Management.Automation.ErrorRecord]$Record) {
    # The last 'not yet' cause, bounded, for the deadline refusal that follows it.
    $exception=$Record.Exception
    if(($exception -is [Management.Automation.MethodInvocationException] -or $exception -is [Management.Automation.GetValueInvocationException]) -and $null -ne $exception.InnerException) { $exception=$exception.InnerException }
    $message=[string]$exception.Message
    return ('; last: '+$exception.GetType().FullName+': '+$message.Substring(0,[Math]::Min(256,$message.Length)))
}
function Snapshot([string]$Name, $Owner) {
    $Owner.Capture((Join-Path $proof ($Name+'.png')))
}
function Launch {
    WithinBudget
    $owner = New-Object JobApplyValidation.OwnedApp
    [void]$owners.Add($owner) # Attach custody before the fallible child creation operation.
    $owner.Start((Join-Path $packageRoot 'desktop.exe'))
    return $owner
}
function Ready($Owner) {
    $limit = [Math]::Min($budgetSeconds, $clock.Elapsed.TotalSeconds+240) # DIAG: measure, was 35
    $diagNext = 0
    $clicked = $false
    $retried = $null
    $transient = ''
    do {
        WithinBudget
        try {
            $names = @($Owner.Names())
            $diagKey=($names -join '|')
            if($diagKey -cne $script:diagLastNames -or $clock.Elapsed.TotalSeconds -ge $diagNext) { $script:diagLastNames=$diagKey; $diagNext=$clock.Elapsed.TotalSeconds+30; try { $members=@($Owner.Members()); [IO.File]::AppendAllText((Join-Path $proof 'diag-ready.ndjson'),((([ordered]@{at_ms=$clock.ElapsedMilliseconds;members=$members.Count;names=@($names|Select-Object -First 400)})|ConvertTo-Json -Compress)+"`r`n")) } catch { } }
            # Readiness is tested first, so a Ready result never starts another check;
            # a result that is not ready is checked again at most every 2 s.
            if ($names -contains 'Ready' -and ($names -join ' ') -match '0\.0\.1' -and ($names -join ' ') -match '1\.0\.0') { return }
            if (-not $clicked -and $names -contains 'Diagnostics') { $Owner.Invoke('Diagnostics'); $clicked=$true }
            elseif ($names -contains 'Check again' -and ($null -eq $retried -or $clock.Elapsed.TotalSeconds -ge $retried+2)) { $retried=$clock.Elapsed.TotalSeconds; $Owner.Invoke('Check again') }
        } catch { if (-not (NotYet $_)) { throw }; $transient=LastTransient $_ }
        Start-Sleep -Milliseconds 250
    } while ($clock.Elapsed.TotalSeconds -lt $limit)
    throw ('Actual owned Diagnostics Ready/version UI not observed'+$transient)
}
function MachineScalar($Value,[string]$Name) {
    # Total strict read of one protected receipt member: absent or structured is $null.
    if($null -eq $Value) { return $null }
    $property=$Value.PSObject.Properties[$Name]
    if($null -eq $property -or $property.Value -is [Array] -or $property.Value -is [Management.Automation.PSCustomObject]) { return $null }
    return $property.Value
}
function ProtectedReceipt([string]$Path) {
    # One bounded protected receipt, or $null while it is absent, partial, still being
    # written or unreadable. It is read through one shared handle, never by path, so a
    # poll never blocks an attestor removing an earlier run's file (KI-0175).
    try { $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)) } catch { return $null }
    $bytes=New-Object byte[] (64KB+1)
    $count=0
    try { do { $read=$stream.Read($bytes,$count,$bytes.Length-$count); $count+=$read } while($read -gt 0 -and $count -lt $bytes.Length) } finally { $stream.Dispose() }
    if($count -gt 64KB) { throw 'Bounded protected machine receipt required' }
    try { return ([Text.Encoding]::UTF8.GetString($bytes,0,$count).TrimStart([char]0xFEFF)|ConvertFrom-Json) } catch { return $null }
}
function MachineDiffers($Record,[string]$Schema,[string]$Boot) {
    # The members that bind a protected record to this run's nonce and this boot.
    $mismatch=New-Object Collections.ArrayList
    if((MachineScalar $Record 'schema') -cne $Schema) { [void]$mismatch.Add('schema') }
    if((MachineScalar $Record 'nonce') -cne $config.nonce) { [void]$mismatch.Add('nonce') }
    if((MachineScalar $Record 'boot_time') -cne $Boot) { [void]$mismatch.Add('boot_time') }
    return ,@($mismatch)
}
function TimestampParts([string]$Value) {
    $matched=[Text.RegularExpressions.Regex]::Match($Value,'^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?Z$',[Text.RegularExpressions.RegexOptions]::CultureInvariant)
    if(-not $matched.Success -or $matched.Length -ne $Value.Length) { throw 'Exact UTC timestamp required' }
    $whole=[DateTime]::new([int]$matched.Groups[1].Value,[int]$matched.Groups[2].Value,[int]$matched.Groups[3].Value,[int]$matched.Groups[4].Value,[int]$matched.Groups[5].Value,[int]$matched.Groups[6].Value,[DateTimeKind]::Utc)
    return @{whole_ticks=[long]$whole.Ticks;nanoseconds=[long]$matched.Groups[7].Value.PadRight(9,'0')}
}
function TimestampAdvances([string]$Before,[string]$After) {
    $left=TimestampParts $Before;$right=TimestampParts $After
    return $right.whole_ticks -gt $left.whole_ticks -or ($right.whole_ticks -eq $left.whole_ticks -and $right.nanoseconds -gt $left.nanoseconds)
}
function TryCheckedAt($Owner) {
    # A loading or remounted panel renders no timestamp; that is 'not yet'.
    $found=@($Owner.Names()|Where-Object { $_ -cmatch '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$' }|Select-Object -Unique)
    if($found.Count -ne 1) { return $null }
    return [string]$found[0]
}
function DiagWaitLog([string]$Name,[double]$Start,[bool]$Ok) {
    # DIAG round 44: how long each bounded UI wait took in the VM.
    try { [IO.File]::AppendAllText((Join-Path $proof 'diag-waits.txt'),($Name+' ms='+[long](($clock.Elapsed.TotalSeconds-$Start)*1000)+' ok='+$Ok+"`r`n")) } catch { }
}
function WaitCheckedAt($Owner) {
    $diagStart=$clock.Elapsed.TotalSeconds
    $limit=[Math]::Min($budgetSeconds,$clock.Elapsed.TotalSeconds+30) # DIAG: measure, was 6
    $transient=''
    do {
        WithinBudget
        try { $value=TryCheckedAt $Owner; if($null -ne $value){DiagWaitLog 'WaitCheckedAt' $diagStart $true; return $value} } catch { if(-not(NotYet $_)){throw}; $transient=LastTransient $_ }
        Start-Sleep -Milliseconds 25
    } while($clock.Elapsed.TotalSeconds -lt $limit)
    DiagWaitLog 'WaitCheckedAt' $diagStart $false
    throw ('Exactly one actual Checked at timestamp required'+$transient)
}
function CheckedAdvance($Owner,[string]$Before) {
    $diagStart=$clock.Elapsed.TotalSeconds
    $limit=[Math]::Min($budgetSeconds,$clock.Elapsed.TotalSeconds+30) # DIAG: measure, was 6
    $transient=''
    do {
        WithinBudget
        $after=$null
        try { $after=TryCheckedAt $Owner } catch { if(-not(NotYet $_)){throw}; $transient=LastTransient $_ }
        if($null -ne $after -and $after -cne $Before) {
            if(-not(TimestampAdvances $Before $after)) { throw 'Owned Enter keyboard action did not advance Checked at' }
            DiagWaitLog 'CheckedAdvance' $diagStart $true
            return $after
        }
        Start-Sleep -Milliseconds 25
    } while($clock.Elapsed.TotalSeconds -lt $limit)
    DiagWaitLog 'CheckedAdvance' $diagStart $false
    throw ('Owned Enter keyboard action did not advance Checked at'+$transient)
}
function ShellWait([scriptblock]$Predicate) {
    $diagStart=$clock.Elapsed.TotalSeconds; $diagName='ShellWait '+$Predicate.ToString().Trim()
    $limit=[Math]::Min($budgetSeconds,$clock.Elapsed.TotalSeconds+30) # DIAG: measure, was 3
    $transient=''
    do {
        WithinBudget
        try { if(& $Predicate){DiagWaitLog ($diagName+$(if($diagName -clike '*-not $Owner.ShellRouteLinkFocused*'){' | '+[JobApplyValidation.OwnedApp]::FocusDiag()}else{''})) $diagStart $true; return} } catch { if(-not(NotYet $_)){throw}; $transient=LastTransient $_ }
        Start-Sleep -Milliseconds 25
    } while($clock.Elapsed.TotalSeconds -lt $limit)
    DiagWaitLog $diagName $diagStart $false
    # DIAG round 45: record focus, then (diagnostic only) one more key to tell a lost key from a stuck focus.
    $focusLog=Join-Path $proof 'diag-focus.txt'
    try { [IO.File]::AppendAllText($focusLog,('FAIL at_ms='+$clock.ElapsedMilliseconds+' '+$diagName+' | '+[JobApplyValidation.OwnedApp]::FocusDiag()+"`r`n")) } catch { }
    $retryKey=$(if($diagName -clike '*-not $Owner.ShellRouteLinkFocused*'){'tab'}elseif($diagName -clike '*$Owner.ShellRouteLinkFocused*'){'backtab'}else{'enter'})
    try { $Owner.Capture((Join-Path $proof ('diag-fail-'+$clock.ElapsedMilliseconds+'.png'))) } catch { try { [IO.File]::AppendAllText($focusLog,('DIAG-CAPTURE-ERROR '+$_.Exception.GetType().FullName+"`r`n")) } catch { } }
    try { [IO.File]::AppendAllText($focusLog,('webview2-runtimes '+((@(Get-ChildItem -LiteralPath 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name+'@'+$_.CreationTimeUtc.ToString('o') })) -join ',')+' webview2-processes '+((@(Get-Process msedgewebview2 -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.Id+'@'+$_.StartTime.ToUniversalTime().ToString('HH:mm:ss') })) -join ',')+"`r`n")) } catch { }
    foreach($attempt in 1..12) {
        try {
            $Owner.ShellKeys($retryKey)
            $retryStart=$clock.Elapsed.TotalSeconds
            while($clock.Elapsed.TotalSeconds -lt $retryStart+5) { try { if(& $Predicate){ [IO.File]::AppendAllText($focusLog,('DIAG-RETRY-OK attempt='+$attempt+' key='+$retryKey+' ms='+[long](($clock.Elapsed.TotalSeconds-$retryStart)*1000)+' | '+[JobApplyValidation.OwnedApp]::FocusDiag()+"`r`n")); return } } catch { }; Start-Sleep -Milliseconds 25 }
            [IO.File]::AppendAllText($focusLog,('DIAG-RETRY-FAIL attempt='+$attempt+' at_ms='+$clock.ElapsedMilliseconds+' key='+$retryKey+' | '+[JobApplyValidation.OwnedApp]::FocusDiag()+"`r`n"))
        } catch { try { [IO.File]::AppendAllText($focusLog,('DIAG-RETRY-ERROR attempt='+$attempt+' '+$_.Exception.GetType().FullName+': '+$_.Exception.Message+"`r`n")) } catch { } }
    }
    throw ('Actual bounded native shell focus or geometry did not settle'+$transient)
}
function ShellMeasurement($Owner,[string]$Stage,[string]$PreviousAnchors) {
    $diagStart=$clock.Elapsed.TotalSeconds
    $limit=[Math]::Min($budgetSeconds,$clock.Elapsed.TotalSeconds+30) # DIAG: measure, was 3
    $last=''; $lastRow=$null; $transient=''
    do {
        WithinBudget
        $row=$null
        # A document still laying out is 'not yet' and breaks the consecutive pair.
        try { $row=$Owner.ShellMeasure($Stage) } catch { if(-not(NotYet $_)){throw}; $last=''; $transient=LastTransient $_ }
        if($null -ne $row) {
            $anchors=$row.anchors|ConvertTo-Json -Depth 10 -Compress
            if($anchors -ceq $last -and ($PreviousAnchors -ceq '' -or $anchors -cne $PreviousAnchors)){DiagWaitLog ('ShellMeasurement '+$Stage) $diagStart $true; return $row}
            $last=$anchors; $lastRow=$row
        }
        Start-Sleep -Milliseconds 50
    } while($clock.Elapsed.TotalSeconds -lt $limit)
    DiagWaitLog ('ShellMeasurement '+$Stage) $diagStart $false
    if($null -ne $lastRow){$lastRow|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $proof ('shell-unsettled-'+$Stage+'.json')) -Encoding UTF8}
    throw ('Actual visible complete glyph measurement unavailable or unchanged after chord'+$transient)
}
function DesktopVersionsShown($Owner) {
    # Diagnostics renders both version rows only after its mount-time metadata load.
    $names=@($Owner.Names())
    return ($names -ccontains 'App version' -and $names -ccontains 'Tauri version')
}
function ShellCapture($Owner) {
    $destinations=@(@('home','Home'),@('jobs','Jobs'),@('tracker','Tracker'),@('documents','Documents / Resumes'),@('profile','Profile'),@('settings','Settings'),@('diagnostics','Diagnostics'))
    $captures=New-Object Collections.ArrayList
    $measures=New-Object Collections.ArrayList
    foreach($scale in @('baseline','enlarged')) {
        if($scale -ceq 'baseline') {
            $Owner.ShellFocusRoute('Diagnostics');$Owner.ShellKeys('enter');$Owner.ShellKeys('reset')
            Start-Sleep -Milliseconds 100
        } else {
            $baseline=ShellMeasurement $Owner 'baseline' ''
            [void]$measures.Add($baseline)
            $prior=$baseline.anchors|ConvertTo-Json -Depth 10 -Compress
            foreach($increment in 1..5) {
                $Owner.ShellKeys('zoom')
                $measurement=ShellMeasurement $Owner ('step'+$increment) $prior
                [void]$measures.Add($measurement)
                $prior=$measurement.anchors|ConvertTo-Json -Depth 10 -Compress
            }
        }
        foreach($destination in $destinations) {
            WithinBudget
            $slug=$destination[0];$label=$destination[1]
            $Owner.ShellFocusRoute($label)
            $Owner.ShellKeys('tab');ShellWait { -not $Owner.ShellRouteLinkFocused($label) }
            $Owner.ShellKeys('backtab');ShellWait { $Owner.ShellRouteLinkFocused($label) }
            $Owner.ShellKeys('enter');ShellWait { $Owner.ShellRouteFocused($label) }
            $checkedBefore=$null;$checkedAfter=$null
            if($slug -ceq 'diagnostics') {
                # The remounted route runs two mount-time loads (the service check and the
                # version metadata); its tree is read only after both have rendered.
                $checkedBefore=WaitCheckedAt $Owner;ShellWait { DesktopVersionsShown $Owner }
            }
            $name='shell-'+$scale+'-'+$slug
            Snapshot $name $Owner
            $tree=$Owner.ShellTree()|ConvertTo-Json -Depth 10
            if($tree.Length -gt 1048576){throw 'Actual native shell tree exceeds retained cap'}
            $tree|Set-Content -LiteralPath (Join-Path $proof ($name+'.json')) -Encoding UTF8
            $imagePath=Join-Path $proof ($name+'.png')
            $image=[Drawing.Image]::FromFile($imagePath)
            try {$width=$image.Width;$height=$image.Height} finally {$image.Dispose()}
            $geometry=$Owner.ShellRouteGeometry($label)
            if($slug -ceq 'diagnostics') { $Owner.KeyboardCheckAgain();$checkedAfter=CheckedAdvance $Owner $checkedBefore }
            $Owner.ShellFocusSkip();$Owner.ShellKeys('enter');ShellWait { $Owner.ShellMainFocused() }
            [void]$captures.Add(@{scale=$scale;route=$slug;heading=$label;heading_unique=$true;heading_focused=$true;navigation_unique=$true;checked_before=$checkedBefore;checked_after=$checkedAfter;glyph=$geometry.glyph;frame=$geometry.frame;backing=$geometry.backing;window_id=$geometry.window_id;app_pid=$geometry.app_pid;tab_shift_tab=$true;skip_main=$true;image_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $imagePath).Hash.ToLowerInvariant();image_width=$width;image_height=$height})
        }
    }
    $Owner.ShellKeys('reset')
    $reset=ShellMeasurement $Owner 'reset' ''
    [void]$measures.Add($reset)
    Snapshot 'shell-reset' $Owner
    return @{schema='japp-native-shell-capture-v1';policy_sha256='7aaf7a099cf111661c9fd6e98497ebf97bbb4d6a1c72c8d6ec2d20f190735e88';subject_sha256=$config.package_sha256;platform='WINDOWS_UIA';measurements=@($measures);routes=@($captures);reset_image=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $proof 'shell-reset.png')).Hash.ToLowerInvariant();reader_output='NOT_COLLECTED'}
}
function Endpoint($Owner) {
    $image = Join-Path $packageRoot 'runtime\japp-orchestrator\japp-orchestrator.exe'
    # Same volume and file ID, never path text: 8.3 or other aliases name one image.
    $ids = @($Owner.Members() | Where-Object { $Owner.MemberIsImage($_, $image) })
    if ($ids.Count -ne 1) { throw 'Exactly one retained owned service image required' }
    $held = $Owner.OpenMember($ids[0], $image)
    try {
        $listeners = @(Get-NetTCPConnection -OwningProcess $held.Pid -State Listen -ErrorAction Stop)
        if ($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1') { throw 'Complete owned listener inventory must be exactly one IPv4 loopback endpoint' }
        return @{pid=[long]$held.Pid;creation_time=$held.CreationTime;port=[int]$listeners[0].LocalPort}
    } finally { $held.Dispose() }
}
function Released([int]$Port) {
    # One bounded raw TCP connection, after owned-job drain. No sleep/retry/bind claim.
    # Windows refuses a closed loopback port only after its SYN retries, about 2 s
    # on hosted windows-2025 (run 41137888774, KI-0106); refusal is still required.
    $socket = New-Object Net.Sockets.Socket([Net.Sockets.AddressFamily]::InterNetwork,[Net.Sockets.SocketType]::Stream,[Net.Sockets.ProtocolType]::Tcp)
    try {
        $pending = $socket.BeginConnect([Net.IPAddress]::Loopback,$Port,$null,$null)
        if (-not $pending.AsyncWaitHandle.WaitOne(5000)) { throw 'Listener release observation timed out' }
        try { $socket.EndConnect($pending); throw 'Owned retired endpoint still accepts TCP' }
        catch [Net.Sockets.SocketException] { if ($_.Exception.SocketErrorCode -ne [Net.Sockets.SocketError]::ConnectionRefused) { throw } }
        finally { $pending.AsyncWaitHandle.Close() }
    } finally { $socket.Dispose() }
}
function Closed($Owner, [int]$Port) {
    if (-not $Owner.WaitEmpty(6000)) { throw 'Native owned shutdown left job members' }
    Released $Port
    $Owner.Dispose()
}
function UnauthenticatedEnvelope($Body) {
    # The orchestrator refuses with its canonical error record: exactly
    # {envelope,payload}, the error-record schema and the closed code (responses.py).
    if ($Body -isnot [Management.Automation.PSCustomObject]) { return $false }
    if ((@($Body.PSObject.Properties.Name | Sort-Object) -join ',') -cne 'envelope,payload') { return $false }
    $envelope=$Body.envelope; $payload=$Body.payload
    if ($envelope -isnot [Management.Automation.PSCustomObject] -or $payload -isnot [Management.Automation.PSCustomObject]) { return $false }
    $schema=$envelope.PSObject.Properties['schema_id']; $code=$payload.PSObject.Properties['code']
    return ($null -ne $schema -and $null -ne $code -and $schema.Value -is [string] -and $code.Value -is [string] -and $schema.Value -ceq 'urn:japp:schema:error:record:v1' -and $code.Value -ceq 'TRANSPORT_UNAUTHENTICATED')
}
function Unauthorized([int]$Port) {
    Add-Type -AssemblyName System.Net.Http
    $statuses = New-Object Collections.ArrayList
    foreach ($route in @('/api/v1/health','/api/v1/ready','/api/v1/version')) {
        foreach ($header in @($null,'Bearer','Bearer synthetic-invalid-fixture','Basic synthetic-invalid-fixture')) {
            WithinBudget
            $handler = New-Object Net.Http.HttpClientHandler
            $handler.UseProxy=$false; $handler.AllowAutoRedirect=$false
            $client = New-Object Net.Http.HttpClient($handler)
            $client.Timeout=[TimeSpan]::FromSeconds(2)
            $request = New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Get,('http://127.0.0.1:'+ $Port + $route))
            if ($null -ne $header) { [void]$request.Headers.TryAddWithoutValidation('Authorization',$header) }
            $response=$null
            try {
                $response=$client.SendAsync($request,[Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
                if ([int]$response.StatusCode -ne 401) { throw 'Ordinary unauthorized request not refused' }
                $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                try {
                    $buffer=New-Object byte[] 8193
                    $count=0
                    do { $pending=$stream.ReadAsync($buffer,$count,$buffer.Length-$count); if(-not $pending.Wait(2000)){throw 'Bounded unauthorized response read expired'}; $read=$pending.GetAwaiter().GetResult(); $count+=$read } while ($read -gt 0 -and $count -lt $buffer.Length)
                    if ($count -gt 8192) { throw 'Unauthorized response exceeds cap' }
                    $body=[Text.Encoding]::UTF8.GetString($buffer,0,$count)|ConvertFrom-Json
                    if (-not (UnauthenticatedEnvelope $body)) { throw 'Ordinary transport error envelope or code differs' }
                } finally { $stream.Dispose() }
                [void]$statuses.Add([int]$response.StatusCode)
            } finally { if($null -ne $response){$response.Dispose()}; $request.Dispose(); $client.Dispose(); $handler.Dispose() }
        }
    }
    return ,@($statuses)
}
try {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    $principal=New-Object Security.Principal.WindowsPrincipal($identity)
    if ($identity.Name.Split('\')[-1] -cne 'JappFixture' -or $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or -not [Environment]::UserInteractive -or -not [Environment]::Is64BitProcess) { throw 'Actual standard interactive x64 fixture session required' }
    $manifest=Get-Content -LiteralPath 'C:\ProgramData\JappHarness\seed-manifest.json' -Raw|ConvertFrom-Json
    foreach($entry in $manifest.files.PSObject.Properties) {
        $file=Join-Path 'C:\ProgramData\JappHarness' $entry.Name
        if((Get-Item -LiteralPath $file).Length -ne $entry.Value.bytes -or (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant() -cne $entry.Value.sha256) { throw 'Protected guest input byte binding differs' }
    }
    $framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
    $references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
    Add-Type -TypeDefinition (Get-Content -LiteralPath 'C:\ProgramData\JappHarness\windows11_owned.cs' -Raw) -ReferencedAssemblies $references
    DiagShell 'after-compile'
    $os=Get-CimInstance Win32_OperatingSystem
    $boot=$os.LastBootUpTime.ToUniversalTime().ToString('o')
    $machinePath='C:\ProgramData\JappHarness\machine.json'
    $machineErrorPath='C:\ProgramData\JappHarness\machine-error.json'
    $machineSchema='japp-win11-protected-machine-v1'
    # A completed attestor run took about 10 s (KI-0175 round 35), but a first-logon run
    # can be far slower. The attestor task starts at the same logon as this guest, so
    # the wait ends at the guest clock's 150 s mark (after at least one poll), and the
    # rest of the 300 s work deadline is kept for the phases that follow. The attestor
    # task's own limit is 10 minutes.
    $machineLimit=150
    $machine=$null
    # A parsable receipt bound to this nonce and boot ends the wait, and so does an
    # attestor error bound to this nonce and boot (which then fails below). A partial
    # receipt, one from another run or boot, or an attestor error from another run or
    # boot is 'not yet' for the full bound; a current receipt is read first.
    do {
        $current=ProtectedReceipt $machinePath
        if($null -ne $current) { $machine=$current; if((MachineDiffers $machine $machineSchema $boot).Count -eq 0) { break } }
        $failed=ProtectedReceipt $machineErrorPath
        if($null -ne $failed -and (MachineDiffers $failed 'japp-win11-protected-machine-error-v1' $boot).Count -eq 0) { break }
        Start-Sleep -Milliseconds 250
    } while($clock.Elapsed.TotalSeconds -lt $machineLimit)
    # Both protected receipts hold no secret. They are retained before any check, so a
    # failed attestor step or pin is named by this round's own evidence.
    foreach($retainedName in @('machine-error.json','machine.json')) {
        $retainedPath=Join-Path 'C:\ProgramData\JappHarness' $retainedName
        if(Test-Path -LiteralPath $retainedPath) {
            if((Get-Item -LiteralPath $retainedPath).Length -gt 64KB) { throw 'Bounded protected machine receipt required' }
            Copy-Item -LiteralPath $retainedPath -Destination (Join-Path $proof $retainedName)
        }
    }
    # The attestor's trace holds only step names and UTC times; it names the step a
    # stalled run reached. Its run may still be appending, so it is read with shared
    # access and a fixed bound, never copied by path, and retained before any check.
    $tracePath='C:\ProgramData\JappHarness\attestor-trace.txt'
    if(Test-Path -LiteralPath $tracePath) {
        $traceBytes=New-Object byte[] (64KB+1)
        $traceCount=0
        $traceStream=[IO.File]::Open($tracePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
        try { do { $traceRead=$traceStream.Read($traceBytes,$traceCount,$traceBytes.Length-$traceCount); $traceCount+=$traceRead } while($traceRead -gt 0 -and $traceCount -lt $traceBytes.Length) } finally { $traceStream.Dispose() }
        if($traceCount -gt 64KB) { throw 'Bounded protected attestor trace required' }
        $traceCopy=[IO.File]::Open((Join-Path $proof 'attestor-trace.txt'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
        try { $traceCopy.Write($traceBytes,0,$traceCount) } finally { $traceCopy.Dispose() }
    }
    $mismatch=@()
    if($null -ne $machine) { $mismatch=MachineDiffers $machine $machineSchema $boot }
    if($null -eq $machine -or $mismatch.Count -gt 0) {
        # No current receipt when the wait ended: only an attestor error bound to this
        # nonce and boot names the attestor as the cause.
        $attestorError=ProtectedReceipt $machineErrorPath
        if($null -ne $attestorError -and (MachineDiffers $attestorError 'japp-win11-protected-machine-error-v1' $boot).Count -eq 0) { throw 'Protected machine attestor failed; its named step is retained' }
        if($null -eq $machine) { throw 'Protected current-boot machine attestation missing or unreadable' }
        throw ('Protected current-boot machine attestation differs: '+($mismatch -join ','))
    }
    $unmet=New-Object Collections.ArrayList
    $value=MachineScalar $machine 'caption'; if($value -isnot [string] -or $value -cne 'Microsoft Windows 11 Enterprise Evaluation') { [void]$unmet.Add('caption') }
    if((MachineScalar $machine 'product_type') -ne 1) { [void]$unmet.Add('product_type') }
    if((MachineScalar $machine 'architecture') -cne 'AMD64') { [void]$unmet.Add('architecture') }
    if((MachineScalar $machine 'build') -ne 26300) { [void]$unmet.Add('build') }
    if((MachineScalar $machine 'ubr') -ne 9457) { [void]$unmet.Add('ubr') }
    foreach($name in @('secure_boot','tpm_present','tpm_ready')) { $value=MachineScalar $machine $name; if($value -isnot [bool] -or -not $value) { [void]$unmet.Add($name) } }
    if((MachineScalar $machine 'tpm_spec') -notmatch '^2\.0') { [void]$unmet.Add('tpm_spec') }
    if((MachineScalar $machine 'vcpus') -lt 2) { [void]$unmet.Add('vcpus') }
    if((MachineScalar $machine 'ram_bytes') -lt 4GB) { [void]$unmet.Add('ram_bytes') }
    if((MachineScalar $machine 'disk_bytes') -lt 64GB) { [void]$unmet.Add('disk_bytes') }
    if($unmet.Count -gt 0) { throw ('Actual Windows11 setup/hardware requirements unmet: '+($unmet -join ',')) }
    # Retain actual virtual display measurements; VM policy does not infer physical GPU qualification.
    # DIAG round 42: the dxdiag probes are dropped; the owned launch carries the KI-0180 correction.
    $dxPath=Join-Path $env:TEMP ('JappDx-'+$config.nonce+'.xml')
    $dx=New-Object JobApplyValidation.OwnedApp
    [void]$owners.Add($dx)
    $dx.StartCommand('C:\Windows\System32\dxdiag.exe',@('/whql:off','/x',$dxPath))
    $dxWatch=[Diagnostics.Stopwatch]::StartNew()
    if(-not $dx.WaitEmpty(45000)) { throw 'Owned dxdiag timed out' }
    $dxJobMs=$dxWatch.ElapsedMilliseconds
    $dx.Dispose()
    # DIAG: a late file, then the probe's file, then a labelled fallback so later phases run.
    while(-not (Test-Path -LiteralPath $dxPath) -and $dxWatch.Elapsed.TotalSeconds -lt 75) { Start-Sleep -Milliseconds 500 }
    $dxSource='owned'
    if(-not (Test-Path -LiteralPath $dxPath)) {
        $probeXml=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'JappDxProbe\p1.xml'
        if(Test-Path -LiteralPath $probeXml) { Copy-Item -LiteralPath $probeXml -Destination $dxPath; $dxSource='probe-p1' }
        else {
            $vc=@(Get-CimInstance Win32_VideoController)[0]
            $fallback='<DxDiag><SystemInformation><DirectXVersion>DIAG-FALLBACK 12</DirectXVersion></SystemInformation><DisplayDevices><DisplayDevice><DriverModel>DIAG-FALLBACK WDDM 3</DriverModel><DDIVersion>DIAG-FALLBACK</DDIVersion><CurrentMode>'+[string]$vc.CurrentHorizontalResolution+' x '+[string]$vc.CurrentVerticalResolution+' (32 bit) (60Hz)</CurrentMode></DisplayDevice></DisplayDevices></DxDiag>'
            Set-Content -LiteralPath $dxPath -Value $fallback -Encoding UTF8; $dxSource='DIAG-FALLBACK video='+[string]$vc.Name
        }
    }
    Add-Content -LiteralPath (Join-Path $proof 'diag-dxdiag-owned.txt') -Value ('job_empty_ms='+$dxJobMs+' waited_ms='+$dxWatch.ElapsedMilliseconds+' source='+$dxSource) -Encoding ASCII
    if((Get-Item -LiteralPath $dxPath).Length -gt 4MB) { throw 'Bounded actual display attestation required' }
    [xml]$dxdiag=Get-Content -LiteralPath $dxPath -Raw
    $displays=@($dxdiag.DxDiag.DisplayDevices.DisplayDevice)
    if($displays.Count -ne 1 -or [string]$displays[0].DriverModel -eq '' -or [string]$displays[0].DDIVersion -eq '' -or [string]$displays[0].CurrentMode -notmatch '^(\d+) x (\d+)') { throw 'Bounded actual virtual display measurement unavailable' }
    $width=[int]$Matches[1]; $height=[int]$Matches[2]
    if($width -lt 640 -or $height -lt 480) { throw 'Actual owned desktop below harness capture geometry' }
    $directXMatch=[regex]::Match([string]$dxdiag.DxDiag.SystemInformation.DirectXVersion,'\d+')
    $wddmMatch=[regex]::Match([string]$displays[0].DriverModel,'\d+')
    if(-not $directXMatch.Success -or -not $wddmMatch.Success) { throw 'Actual virtual graphics version measurement unavailable' }
    Copy-Item -LiteralPath $dxPath -Destination (Join-Path $proof 'dxdiag.xml')
    $attestation=[ordered]@{schema='japp-win11-native-environment-v1';nonce=$config.nonce;caption=$machine.caption;product_type=[int]$machine.product_type;architecture='X64';build=[int]$machine.build;ubr=[int]$machine.ubr;secure_boot=[bool]$machine.secure_boot;tpm_present=[bool]$machine.tpm_present;tpm_ready=[bool]$machine.tpm_ready;tpm_spec=$machine.tpm_spec;vcpus=[int]$machine.vcpus;ram_bytes=[long]$machine.ram_bytes;disk_bytes=[long]$machine.disk_bytes;cpu_name=$machine.cpu_name;cpu_architecture=$machine.cpu_architecture;cpu_max_mhz=[int]$machine.cpu_max_mhz;directx_version=[string]$dxdiag.DxDiag.SystemInformation.DirectXVersion;driver_model=[string]$displays[0].DriverModel;ddi_version=[string]$displays[0].DDIVersion;directx_major=[int]$directXMatch.Value;wddm_major=[int]$wddmMatch.Value;display_width=$width;display_height=$height;interactive=[Environment]::UserInteractive;elevated=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);package_sha256=$config.package_sha256}
    $attestation|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $proof 'environment.json') -Encoding UTF8
    Receipt 'environment' @{attestation=$attestation}
    # The Linux owner independently validates actual attestation/frame before product launch.
    HostAccepted ('JAPP11-ENV-ACCEPT '+$config.nonce) 15000 'Host did not accept actual native environment'
    DiagMark 'env-accepted'
    try { & tasklist.exe /svc /fo csv | Set-Content -LiteralPath (Join-Path $proof 'diag-services.csv') -Encoding UTF8; & logman.exe query -ets | Set-Content -LiteralPath (Join-Path $proof 'diag-etw-env.txt') -Encoding UTF8 } catch { }
    # DIAG: an unowned process snapshot every 2 s, so the last one before a restart is kept.
    $diagLogger=Join-Path $env:TEMP 'diag-procs.ps1'
    Set-Content -LiteralPath $diagLogger -Encoding ASCII -Value @'
param([string]$Out)
$seen=@{}; $etw=@{}; $t=[Diagnostics.Stopwatch]::StartNew(); $nextEtw=0
while($t.Elapsed.TotalSeconds -lt 900) {
    $now=@(Get-Process | ForEach-Object { [string]$_.Id+':'+$_.ProcessName })
    $new=@($now | Where-Object { -not $seen.ContainsKey($_) })
    foreach($k in $now) { $seen[$k]=1 }
    $newEtw=@()
    if($t.Elapsed.TotalSeconds -ge $nextEtw) { $nextEtw=$t.Elapsed.TotalSeconds+3; foreach($line in @(& logman.exe query -ets)) { $name=([string]$line).Trim(); if($name -and -not $etw.ContainsKey($name)) { $etw[$name]=1; $newEtw+=$name } } }
    try { [IO.File]::AppendAllText($Out,('t_ms='+$t.ElapsedMilliseconds+' count='+$now.Count+' new='+($new -join ',')+$(if($newEtw.Count){' etw='+($newEtw -join ' ; ')}else{''})+"`r`n")) } catch { }
    Start-Sleep -Milliseconds 1000
}
'@
    Start-Process -WindowStyle Hidden -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$diagLogger,'-Out',(Join-Path $proof 'diag-procs.txt'))
    $zip='C:\ProgramData\JappHarness\windows-portable.zip'
    if((Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant() -cne $config.package_sha256) { throw 'Original portable archive changed' }
    # A long-form profile base: %TEMP% is an 8.3 alias (JAPPFI~1) for this 11-character user.
    $localData=[Environment]::GetFolderPath('LocalApplicationData')
    if([string]::IsNullOrEmpty($localData) -or -not [IO.Path]::IsPathRooted($localData)) { throw 'Actual long-form local application data folder required' }
    $packageRoot=Join-Path $localData ('JobApply '+[char]0x03A9+' space '+$config.nonce.Substring(0,12))
    if(Test-Path -LiteralPath $packageRoot) { throw 'Fresh Unicode/spaces package namespace required' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    DiagMark 'zip-verified'
    [IO.Compression.ZipFile]::ExtractToDirectory($zip,$packageRoot)
    DiagMark 'extracted'
    foreach($entry in $config.portable_files.PSObject.Properties) {
        $file=Join-Path $packageRoot $entry.Name
        if((Get-Item -LiteralPath $file).Length -ne $entry.Value.bytes -or (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant() -cne $entry.Value.sha256) { throw 'Exact inspected portable file differs' }
    }
    $actual=@(Get-ChildItem -LiteralPath $packageRoot -File -Recurse)
    if($actual.Count -ne @($config.portable_files.PSObject.Properties).Count) { throw 'Exact portable inventory differs' }
    DiagMark 'inventory-ok'
    DiagServiceCold; DiagMark 'service-cold-done' # DIAG-SVCFIRST
    $phase='ready'; $app=Launch; DiagMark 'launched'; Ready $app; DiagMark 'ready-ok'; $endpoint=Endpoint $app; DiagMark 'endpoint-ok'; DiagShell 'before-ready-capture'; Snapshot 'ready' $app; DiagMark 'ready-captured'
    Receipt 'ready' @{pid=[long]$app.Pid;service=$endpoint;version='0.0.1';api_version='1.0.0';unicode_spaces_path=$true}
    $phase='unauthorized12'; $statuses=Unauthorized $endpoint.port; Receipt 'unauthorized12' @{statuses=$statuses}
    $phase='keyboard'; $checkedBefore=WaitCheckedAt $app; $app.KeyboardCheckAgain(); $checkedAfter=CheckedAdvance $app $checkedBefore
    Snapshot 'keyboard' $app; $nativeShell=ShellCapture $app; $nativeShell|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $proof 'native-shell.json') -Encoding UTF8; Receipt 'keyboard' @{action='owned_foreground_focused_Check_again_Enter';checked_before=$checkedBefore;checked_after=$checkedAfter;native_shell=$nativeShell}
    $phase='crash'; $serviceHandle=$app.OpenMember([uint32]$endpoint.pid,(Join-Path $packageRoot 'runtime\japp-orchestrator\japp-orchestrator.exe')); $serviceHandle.Kill()
    $until=$clock.Elapsed.TotalSeconds+6
    while(-not $serviceHandle.Exited -and $clock.Elapsed.TotalSeconds -lt $until) { Start-Sleep -Milliseconds 25 }
    if(-not $serviceHandle.Exited) { throw 'Held service did not exit after controlled crash' }
    Receipt 'crash' @{held_service_pid=$endpoint.pid;held_creation_time=$serviceHandle.CreationTime}
    $serviceHandle.Dispose(); $serviceHandle=$null
    $app.CloseWindow(); Closed $app $endpoint.port
    $phase='restart'; $app=Launch; Ready $app; $endpoint=Endpoint $app; Snapshot 'restart' $app
    Receipt 'restart' @{service=$endpoint;scope='close_and_relaunch_after_controlled_service_crash'}
    $phase='close'; $app.CloseWindow(); Closed $app $endpoint.port; Receipt 'close' @{remaining_owned_processes=0;listener='ConnectionRefused'}
    $phase='relaunch'; $app=Launch; Ready $app; $endpoint=Endpoint $app; Snapshot 'relaunch' $app; Receipt 'relaunch' @{service=$endpoint;scope='same_immutable_package_update_neutral'}
    $app.CloseWindow(); Closed $app $endpoint.port
    $phase='collision'; $collision=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,$endpoint.port); $collision.ExclusiveAddressUse=$true; $collision.Start(1)
    $app=Launch; Ready $app; $next=Endpoint $app
    if($next.port -eq $endpoint.port) { throw 'Product used the actively occupied retired port' }
    Snapshot 'collision' $app
    Receipt 'collision' @{occupied_port=$endpoint.port;service=$next;scope='retired_port_occupied_before_new_random_port_launch_not_forced_startup_race'}
    $collision.Stop(); $collision=$null
    $phase='quit'
    # A missing distinct product Quit control is a real incomplete capability.
    # A Win32 menu-bar popup is a desktop-root window, not part of the app window's subtree.
    $app.Expand('File'); $app.InvokePopupItem('Quit'); Closed $app $next.port
    Receipt 'quit' @{remaining_owned_processes=0;action='owned_UIAutomation_InvokePattern_Quit'}
    $phase='accelerator'; $app=Launch; Ready $app; $endpoint=Endpoint $app
    # KI-0127: a chord that does not quit names which owned process held keyboard focus.
    $focusOwner=$app.FocusOwner(); $app.KeyboardQuit()
    if(-not $app.WaitEmpty(6000)) { throw ('Owned foreground Ctrl+Q left owned job members after 6 s; keyboard focus owner before the chord: '+$focusOwner) }
    Closed $app $endpoint.port
    Receipt 'accelerator' @{remaining_owned_processes=0;action='owned_foreground_Ctrl_Q'}
    $phase='forced-parent'; $app=Launch; Ready $app; $endpoint=Endpoint $app; $app.KillRoot(); Closed $app $endpoint.port
    Receipt 'forced-parent' @{remaining_owned_processes=0;action='held_parent_TerminateProcess_without_emergency_job_kill'}
    $phase='cleanup'; Receipt 'cleanup' @{remaining_owned_processes=0}
    $terminal=[ordered]@{terminal='PASS';nonce=$config.nonce;package_sha256=$config.package_sha256}
} catch {
    $failure=[ordered]@{terminal='FAIL';phase=$phase;nonce=$config.nonce;package_sha256=$config.package_sha256;elapsed_ms=[long]$clock.ElapsedMilliseconds;error_type=$_.Exception.GetType().FullName;message=$_.Exception.Message.Substring(0,[Math]::Min(512,$_.Exception.Message.Length))}
    $failure|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $proof 'failure.json') -Encoding UTF8
    $terminal=$failure
} finally {
    $cleanup=New-Object Collections.ArrayList
    if($null -ne $collision) {
        try { $collision.Stop(); [void]$cleanup.Add(@{stage='collision-socket';settled=$true}) }
        catch { [void]$cleanup.Add(@{stage='collision-socket';settled=$false;error_type=$_.Exception.GetType().FullName}) }
    }
    if($null -ne $serviceHandle) {
        try { $serviceHandle.Dispose(); [void]$cleanup.Add(@{stage='held-service-handle';settled=$true}) }
        catch { [void]$cleanup.Add(@{stage='held-service-handle';settled=$false;error_type=$_.Exception.GetType().FullName}) }
    }
    foreach($owner in $owners) { try { $owner.Dispose(); [void]$cleanup.Add(@{settled=$true}) } catch { [void]$cleanup.Add(@{settled=$false;error_type=$_.Exception.GetType().FullName}) } }
    @($cleanup)|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $proof 'owned-cleanup.json') -Encoding UTF8
    if($null -ne $packageRoot -and @($cleanup|Where-Object {-not $_.settled}).Count -eq 0) {
        try {
            $after=[ordered]@{}
            foreach($entry in $config.portable_files.PSObject.Properties) {
                $file=Join-Path $packageRoot $entry.Name
                $after[$entry.Name]=@{bytes=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant()}
                if($after[$entry.Name].bytes -ne $entry.Value.bytes -or $after[$entry.Name].sha256 -cne $entry.Value.sha256) { throw 'Actual packaged bytes changed' }
            }
            if(@(Get-ChildItem -LiteralPath $packageRoot -File -Recurse).Count -ne @($config.portable_files.PSObject.Properties).Count) { throw 'Actual packaged inventory changed' }
            $after|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $proof 'package-after.json') -Encoding UTF8
        } catch { $terminal=[ordered]@{terminal='FAIL';phase='package-after';nonce=$config.nonce;package_sha256=$config.package_sha256;error_type='PACKAGE_CHANGED';message='Actual package endpoint binding failed'} }
    }
    if(@($cleanup|Where-Object {-not $_.settled}).Count -gt 0) { $terminal=[ordered]@{terminal='FAIL';phase='cleanup';nonce=$config.nonce;package_sha256=$config.package_sha256;error_type='UNSETTLED_OWNED_CUSTODY';message='Retained cleanup-only native custody remains';prior_terminal=$terminal} }
    try { DiagShell 'end'; @([JobApplyValidation.OwnedApp]::ForegroundLog)|Set-Content -LiteralPath (Join-Path $proof 'diag-foreground.txt') -Encoding ASCII } catch { }
    try { $serial.WriteLine('JAPP11 '+($terminal|ConvertTo-Json -Depth 8 -Compress)) } finally { $serial.Close(); $serial.Dispose() }
}
