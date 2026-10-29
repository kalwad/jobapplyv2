param([Parameter(Mandatory=$true)][string]$Configuration)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$clock = [Diagnostics.Stopwatch]::StartNew()
$config = Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
if ($config.schema -ne 'japp-win11-guest-config-v1' -or $config.nonce -cnotmatch '^[0-9a-f]{64}$' -or $config.package_sha256 -cnotmatch '^[0-9a-f]{64}$') { throw 'Closed guest configuration required' }
$resultDisk = @([IO.DriveInfo]::GetDrives() | Where-Object { $_.VolumeLabel -eq 'JAPP-RESULT' })
if ($resultDisk.Count -ne 1) { throw 'Exactly one fresh owned result disk required' }
$proof = Join-Path $resultDisk[0].RootDirectory.FullName 'proof'
if (Test-Path -LiteralPath $proof) { throw 'Fresh proof namespace required' }
New-Item -ItemType Directory -Path $proof | Out-Null
$serial = New-Object IO.Ports.SerialPort('COM1',115200,'None',8,'One')
$serial.WriteTimeout = 500
$serial.Open()
$rows = New-Object Collections.ArrayList
$owners = New-Object Collections.ArrayList
$terminal=$null
$phase = 'environment'
$packageRoot = $null
$collision = $null
$serviceHandle = $null
function Receipt([string]$Name, [hashtable]$Details) {
    $row = [ordered]@{phase=$Name;status='PASS';nonce=$config.nonce;package_sha256=$config.package_sha256;elapsed_ms=[long]$clock.ElapsedMilliseconds}
    foreach ($key in $Details.Keys) { $row[$key]=$Details[$key] }
    [void]$rows.Add($row)
    $line = $row | ConvertTo-Json -Depth 10 -Compress
    if ($line.Length -gt 65536) { throw 'Bounded phase receipt required' }
    Add-Content -LiteralPath (Join-Path $proof 'receipts.ndjson') -Value $line -Encoding UTF8
    $serial.WriteLine('JAPP11 '+$line)
}
function WithinBudget { if ($clock.Elapsed.TotalSeconds -ge 300) { throw 'Guest work deadline exceeded' } }
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
    $limit = [Math]::Min(300, $clock.Elapsed.TotalSeconds+35)
    $clicked = $false
    do {
        WithinBudget
        try { $names = @($Owner.Names()) } catch [InvalidOperationException] { $names=@() }
        if (-not $clicked -and $names -contains 'Diagnostics') { $Owner.Invoke('Diagnostics'); $clicked=$true }
        if ($names -contains 'Check again') { $Owner.Invoke('Check again') }
        if ($names -contains 'Ready' -and ($names -join ' ') -match '0\.0\.1' -and ($names -join ' ') -match '1\.0\.0') { return }
        Start-Sleep -Milliseconds 250
    } while ($clock.Elapsed.TotalSeconds -lt $limit)
    throw 'Actual owned Diagnostics Ready/version UI not observed'
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
function CheckedAt($Owner) {
    $matches=@($Owner.Names()|Where-Object { $_ -cmatch '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$' }|Select-Object -Unique)
    if($matches.Count -ne 1) { throw 'Exactly one actual Checked at timestamp required' }
    return [string]$matches[0]
}
function ShellWait([scriptblock]$Predicate) {
    $limit=[Math]::Min(300,$clock.Elapsed.TotalSeconds+3)
    do { WithinBudget; if(& $Predicate){return}; Start-Sleep -Milliseconds 25 } while($clock.Elapsed.TotalSeconds -lt $limit)
    throw 'Actual bounded native shell focus or geometry did not settle'
}
function ShellMeasurement($Owner,[string]$Stage,[string]$PreviousAnchors) {
    $limit=[Math]::Min(300,$clock.Elapsed.TotalSeconds+3)
    $last=''; $lastRow=$null
    do {
        WithinBudget
        $row=$Owner.ShellMeasure($Stage)
        $anchors=$row.anchors|ConvertTo-Json -Depth 10 -Compress
        if($anchors -ceq $last -and ($PreviousAnchors -ceq '' -or $anchors -cne $PreviousAnchors)){return $row}
        $last=$anchors; $lastRow=$row
        Start-Sleep -Milliseconds 50
    } while($clock.Elapsed.TotalSeconds -lt $limit)
    if($null -ne $lastRow){$lastRow|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $proof ('shell-unsettled-'+$Stage+'.json')) -Encoding UTF8}
    throw 'Actual visible complete glyph measurement unavailable or unchanged after chord'
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
            $name='shell-'+$scale+'-'+$slug
            Snapshot $name $Owner
            $tree=$Owner.ShellTree()|ConvertTo-Json -Depth 10
            if($tree.Length -gt 1048576){throw 'Actual native shell tree exceeds retained cap'}
            $tree|Set-Content -LiteralPath (Join-Path $proof ($name+'.json')) -Encoding UTF8
            $imagePath=Join-Path $proof ($name+'.png')
            $image=[Drawing.Image]::FromFile($imagePath)
            try {$width=$image.Width;$height=$image.Height} finally {$image.Dispose()}
            $geometry=$Owner.ShellRouteGeometry($label)
            $checkedBefore=$null;$checkedAfter=$null
            if($slug -ceq 'diagnostics') {
                $checkedBefore=CheckedAt $Owner;$Owner.KeyboardCheckAgain()
                ShellWait { TimestampAdvances $checkedBefore (CheckedAt $Owner) }
                $checkedAfter=CheckedAt $Owner
            }
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
    $ids = @($Owner.Members() | Where-Object { $Owner.MemberImage($_) -ieq $image })
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
    $socket = New-Object Net.Sockets.Socket([Net.Sockets.AddressFamily]::InterNetwork,[Net.Sockets.SocketType]::Stream,[Net.Sockets.ProtocolType]::Tcp)
    try {
        $pending = $socket.BeginConnect([Net.IPAddress]::Loopback,$Port,$null,$null)
        if (-not $pending.AsyncWaitHandle.WaitOne(250)) { throw 'Listener release observation timed out' }
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
                    if ($body.error.code -ne 'TRANSPORT_UNAUTHENTICATED') { throw 'Ordinary transport error code differs' }
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
    $os=Get-CimInstance Win32_OperatingSystem
    $boot=$os.LastBootUpTime.ToUniversalTime().ToString('o')
    $machinePath='C:\ProgramData\JappHarness\machine.json'
    $machineLimit=$clock.Elapsed.TotalSeconds+30
    while(-not(Test-Path -LiteralPath $machinePath) -and $clock.Elapsed.TotalSeconds -lt $machineLimit) { Start-Sleep -Milliseconds 250 }
    $machine=Get-Content -LiteralPath $machinePath -Raw|ConvertFrom-Json
    if($machine.schema -ne 'japp-win11-protected-machine-v1' -or $machine.nonce -cne $config.nonce -or $machine.boot_time -cne $boot) { throw 'Protected current-boot machine attestation missing' }
    if($machine.caption -cne 'Microsoft Windows 11 Enterprise Evaluation' -or $machine.product_type -ne 1 -or $machine.architecture -cne 'AMD64' -or $machine.build -ne 26300 -or $machine.ubr -ne 9457 -or -not $machine.secure_boot -or -not $machine.tpm_present -or -not $machine.tpm_ready -or $machine.tpm_spec -notmatch '^2\.0' -or $machine.vcpus -lt 2 -or $machine.ram_bytes -lt 4GB -or $machine.disk_bytes -lt 64GB) { throw 'Actual Windows11 setup/hardware requirements unmet' }
    # Retain actual virtual display measurements; VM policy does not infer physical GPU qualification.
    $dxPath=Join-Path $env:TEMP ('JappDx-'+$config.nonce+'.xml')
    $dx=New-Object JobApplyValidation.OwnedApp
    [void]$owners.Add($dx)
    $dx.StartCommand('C:\Windows\System32\dxdiag.exe',@('/whql:off','/x',$dxPath))
    if(-not $dx.WaitEmpty(45000)) { throw 'Owned dxdiag timed out' }
    $dx.Dispose()
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
    $serial.ReadTimeout=15000
    if($serial.ReadLine() -cne ('JAPP11-ENV-ACCEPT '+$config.nonce)) { throw 'Host did not accept actual native environment' }
    $zip='C:\ProgramData\JappHarness\windows-portable.zip'
    if((Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant() -cne $config.package_sha256) { throw 'Original portable archive changed' }
    $packageRoot=Join-Path $env:TEMP ('JobApply '+[char]0x03A9+' space '+$config.nonce.Substring(0,12))
    if(Test-Path -LiteralPath $packageRoot) { throw 'Fresh Unicode/spaces package namespace required' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip,$packageRoot)
    foreach($entry in $config.portable_files.PSObject.Properties) {
        $file=Join-Path $packageRoot $entry.Name
        if((Get-Item -LiteralPath $file).Length -ne $entry.Value.bytes -or (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant() -cne $entry.Value.sha256) { throw 'Exact inspected portable file differs' }
    }
    $actual=@(Get-ChildItem -LiteralPath $packageRoot -File -Recurse)
    if($actual.Count -ne @($config.portable_files.PSObject.Properties).Count) { throw 'Exact portable inventory differs' }
    $phase='ready'; $app=Launch; Ready $app; $endpoint=Endpoint $app; Snapshot 'ready' $app
    Receipt 'ready' @{pid=[long]$app.Pid;service=$endpoint;version='0.0.1';api_version='1.0.0';unicode_spaces_path=$true}
    $phase='unauthorized12'; $statuses=Unauthorized $endpoint.port; Receipt 'unauthorized12' @{statuses=$statuses}
    $phase='keyboard'; $checkedBefore=CheckedAt $app; $app.KeyboardCheckAgain()
    $keyboardLimit=[Math]::Min(300,$clock.Elapsed.TotalSeconds+6)
    do { WithinBudget; $checkedAfter=CheckedAt $app; if($checkedAfter -cne $checkedBefore){break}; Start-Sleep -Milliseconds 25 } while($clock.Elapsed.TotalSeconds -lt $keyboardLimit)
    if(-not(TimestampAdvances $checkedBefore $checkedAfter)) { throw 'Owned Enter keyboard action did not advance Checked at' }
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
    $app.Expand('File'); $app.Invoke('Quit'); Closed $app $next.port
    Receipt 'quit' @{remaining_owned_processes=0;action='owned_UIAutomation_InvokePattern_Quit'}
    $phase='accelerator'; $app=Launch; Ready $app; $endpoint=Endpoint $app; $app.KeyboardQuit(); Closed $app $endpoint.port
    Receipt 'accelerator' @{remaining_owned_processes=0;action='owned_foreground_Ctrl_Q'}
    $phase='forced-parent'; $app=Launch; Ready $app; $endpoint=Endpoint $app; $app.KillRoot(); Closed $app $endpoint.port
    Receipt 'forced-parent' @{remaining_owned_processes=0;action='held_parent_TerminateProcess_without_emergency_job_kill'}
    $phase='cleanup'; Receipt 'cleanup' @{remaining_owned_processes=0}
    $terminal=[ordered]@{terminal='PASS';nonce=$config.nonce;package_sha256=$config.package_sha256}
} catch {
    $failure=[ordered]@{terminal='FAIL';phase=$phase;nonce=$config.nonce;package_sha256=$config.package_sha256;error_type=$_.Exception.GetType().FullName;message=$_.Exception.Message.Substring(0,[Math]::Min(512,$_.Exception.Message.Length))}
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
    try { $serial.WriteLine('JAPP11 '+($terminal|ConvertTo-Json -Depth 8 -Compress)) } finally { $serial.Close(); $serial.Dispose() }
}
