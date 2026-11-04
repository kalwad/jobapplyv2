# Runs only in the newly installed, isolated evaluation guest during specialize.
# It prepares a standard-user fixture; it never launches the product as SYSTEM.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne 'S-1-5-18') { throw 'SYSTEM specialize context required' }
$seed = @([IO.DriveInfo]::GetDrives() | Where-Object { $_.VolumeLabel -eq 'JAPP-SEED' })
if ($seed.Count -ne 1) { throw 'Exactly one owned read-only seed required' }
$source = $seed[0].RootDirectory.FullName
$manifest = Get-Content -LiteralPath (Join-Path $source 'seed-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.schema -ne 'japp-win11-seed-v1' -or $manifest.nonce -cnotmatch '^[0-9a-f]{64}$') { throw 'Closed seed identity required' }
$harnessRoot = 'C:\ProgramData\JappHarness'
if (Test-Path -LiteralPath $harnessRoot) { throw 'Fresh guest harness namespace required' }
New-Item -ItemType Directory -Path $harnessRoot | Out-Null
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($entry in @(@('S-1-5-18','FullControl'), @('S-1-5-32-544','FullControl'), @('S-1-5-32-545','ReadAndExecute'))) {
    $sid = New-Object Security.Principal.SecurityIdentifier($entry[0])
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, $entry[1], 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $harnessRoot -AclObject $acl
$allowed = @('windows11_guest.ps1','windows11_owned.cs','windows-portable.zip','guest-config.json')
if ((@($manifest.files.PSObject.Properties.Name | Sort-Object) -join ',') -cne (@($allowed | Sort-Object) -join ',')) { throw 'Exact seed files required' }
foreach ($name in $allowed) {
    $path = Join-Path $source $name
    $row = $manifest.files.$name
    if ((Get-Item -LiteralPath $path).Length -ne $row.bytes -or (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -cne $row.sha256) { throw 'Seed byte binding differs' }
    Copy-Item -LiteralPath $path -Destination (Join-Path $harnessRoot $name)
}
Copy-Item -LiteralPath (Join-Path $source 'seed-manifest.json') -Destination $harnessRoot
# The protected machine receipt is made at actual interactive logon, after TPM provisioning.
$attestor = @'
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$harness='C:\ProgramData\JappHarness'
# The task runs at every logon. A trace or cause left by an earlier logon (another
# account, another boot) is never this run's: both are removed before this run starts,
# the trace first, so a run that stops here never leaves an earlier run's trace.
$tracePath=Join-Path $harness 'attestor-trace.txt'
if(Test-Path -LiteralPath $tracePath) { Remove-Item -LiteralPath $tracePath -Force }
$errorPath=Join-Path $harness 'machine-error.json'
if(Test-Path -LiteralPath $errorPath) { Remove-Item -LiteralPath $errorPath -Force }
# One trace line per call: the UTC time and a fixed step name, never a value read.
# The append opens the trace with shared read access, so the guest's shared read never collides with it.
function TraceStep([string]$Name) { try { [IO.File]::AppendAllText($tracePath,([DateTime]::UtcNow.ToString('o')+' '+$Name+"`r`n"),[Text.Encoding]::ASCII) } catch { } }
$step='configuration'
$nonce=$null
$bootTime=$null
try {
    TraceStep 'start'
    TraceStep $step
    $config=Get-Content -LiteralPath (Join-Path $harness 'guest-config.json') -Raw|ConvertFrom-Json
    if($config.nonce -cmatch '^[0-9a-f]{64}$') { $nonce=[string]$config.nonce }
    $step='operating-system'; TraceStep $step
    $os=Get-CimInstance -ClassName Win32_OperatingSystem
    $bootTime=$os.LastBootUpTime.ToUniversalTime().ToString('o')
    $system=Get-CimInstance -ClassName Win32_ComputerSystem
    $step='interactive-user'; TraceStep $step
    if($system.UserName -cne ($env:COMPUTERNAME+'\JappFixture')) { throw ('Exact synthetic interactive fixture required; observed user: '+[string]$system.UserName) }
    # Microsoft's LogonCount=1 off-by-one is settled by the protected first-logon task.
    # No interactive account is elevated to perform this setup.
    $step='autologon'; TraceStep $step
    $winlogon='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
    Set-ItemProperty -LiteralPath $winlogon -Name AutoLogonCount -Value 0
    Set-ItemProperty -LiteralPath $winlogon -Name AutoAdminLogon -Value '0'
    Remove-ItemProperty -LiteralPath $winlogon -Name DefaultPassword -ErrorAction SilentlyContinue
    $step='processors'; TraceStep $step
    $processors=@(Get-CimInstance -ClassName Win32_Processor)
    if($processors.Count -lt 1 -or $processors.Count -gt 2 -or @($processors|Where-Object {$_.Architecture -ne 9 -or $_.Name -cne $processors[0].Name}).Count -ne 0) { throw 'Actual homogeneous AMD64 virtual processors required' }
    $step='system-disk'; TraceStep $step
    $disk=Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    $step='tpm'; TraceStep $step
    $tpm=Get-Tpm
    $spec=Get-CimInstance -Namespace 'root\CIMV2\Security\MicrosoftTpm' -ClassName Win32_Tpm
    $step='version'; TraceStep $step
    $version=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $step='secure-boot'; TraceStep $step
    $secureBoot=[bool](Confirm-SecureBootUEFI)
    $step='record'; TraceStep $step
    $record=[ordered]@{schema='japp-win11-protected-machine-v1';nonce=$config.nonce;boot_time=$bootTime;caption=$os.Caption;product_type=[int]$os.ProductType;architecture=$env:PROCESSOR_ARCHITECTURE;build=[int]$version.CurrentBuildNumber;ubr=[int]$version.UBR;secure_boot=$secureBoot;tpm_present=[bool]$tpm.TpmPresent;tpm_ready=[bool]$tpm.TpmReady;tpm_spec=[string]$spec.SpecVersion;vcpus=[int]$system.NumberOfLogicalProcessors;ram_bytes=[long]$system.TotalPhysicalMemory;disk_bytes=[long]$disk.Size;cpu_name=[string]$processors[0].Name;cpu_architecture='X64';cpu_max_mhz=[int](($processors|Measure-Object -Property MaxClockSpeed -Minimum).Minimum)}
    $record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $harness 'machine.json') -Encoding UTF8
} catch {
    # A bounded, secret-free cause (step, type, message; never a registry value),
    # bound to this run's nonce and boot when known, for the guest's retained proof;
    # then the task still fails. The trace names the step first, so it is complete
    # when the guest sees this run's error.
    TraceStep ('caught at '+$step)
    $message=[string]$_.Exception.Message
    [ordered]@{schema='japp-win11-protected-machine-error-v1';step=$step;nonce=$nonce;boot_time=$bootTime;error_type=$_.Exception.GetType().FullName;message=$message.Substring(0,[Math]::Min(512,$message.Length))}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $harness 'machine-error.json') -Encoding UTF8
    throw
}
TraceStep 'wrote machine.json'
'@
Set-Content -LiteralPath (Join-Path $harnessRoot 'machine-attestor.ps1') -Value $attestor -Encoding UTF8
$action = New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument '-NoProfile -ExecutionPolicy RemoteSigned -File C:\ProgramData\JappHarness\machine-attestor.ps1'
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
# A completed first-logon run took about 10 s (KI-0175 round 35). The limit only ends
# a stalled run, which the scheduler kills with no catch; its trace keeps the last step.
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName 'JappOwnedMachineAttestation' -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
# Explorer's normal startup runs this as the created standard user, with UAC unchanged.
$startup = 'C:\Users\Default\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup'
New-Item -ItemType Directory -Path $startup -Force | Out-Null
Set-Content -LiteralPath (Join-Path $startup 'JappFixture.cmd') -Encoding ASCII -Value '@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy RemoteSigned -File "C:\ProgramData\JappHarness\windows11_guest.ps1" -Configuration "C:\ProgramData\JappHarness\guest-config.json"'
# First-logon state of the synthetic fixture, set in the Default profile it is created
# from (KI-0177): Start does not open by itself at first logon, and the fixture's own
# console is a classic console host in the conhost variant (DIAG).
$profileHive = 'HKU\JappDefaultProfile'
& reg.exe load $profileHive 'C:\Users\Default\NTUSER.DAT' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Default profile hive load failed' }
try {
    & reg.exe add ($profileHive + '\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced') /v StartShownOnUpgrade /t REG_DWORD /d 1 /f | Out-Null # DIAG-START
    if ($LASTEXITCODE -ne 0) { throw 'First-logon Start setting failed' } # DIAG-START
    & reg.exe add ($profileHive + '\Console\%%Startup') /v DelegationConsole /t REG_SZ /d '{B23D10C0-E52E-411E-9D5B-C09FDF709C7D}' /f | Out-Null # DIAG-CONHOST
    if ($LASTEXITCODE -ne 0) { throw 'Console host delegation setting failed' } # DIAG-CONHOST
    & reg.exe add ($profileHive + '\Console\%%Startup') /v DelegationTerminal /t REG_SZ /d '{B23D10C0-E52E-411E-9D5B-C09FDF709C7D}' /f | Out-Null # DIAG-CONHOST
    if ($LASTEXITCODE -ne 0) { throw 'Console terminal delegation setting failed' } # DIAG-CONHOST
} finally {
    [GC]::Collect()
    & reg.exe unload $profileHive | Out-Null
}
if ($LASTEXITCODE -ne 0) { throw 'Default profile hive unload failed' }
# The display stays on for the whole run: framed phases need a live frame (KI-0179).
& powercfg.exe /change monitor-timeout-ac 0
if ($LASTEXITCODE -ne 0) { throw 'Display timeout setting failed' }
