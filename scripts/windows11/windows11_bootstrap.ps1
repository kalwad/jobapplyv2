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
$config=Get-Content -LiteralPath 'C:\ProgramData\JappHarness\guest-config.json' -Raw|ConvertFrom-Json
$os=Get-CimInstance -ClassName Win32_OperatingSystem
$system=Get-CimInstance -ClassName Win32_ComputerSystem
if($system.UserName -cne ($env:COMPUTERNAME+'\JappFixture')) { throw 'Exact synthetic interactive fixture required' }
# Microsoft's LogonCount=1 off-by-one is settled by the protected first-logon task.
# No interactive account is elevated to perform this setup.
$winlogon='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Set-ItemProperty -LiteralPath $winlogon -Name AutoLogonCount -Value 0
Set-ItemProperty -LiteralPath $winlogon -Name AutoAdminLogon -Value '0'
Remove-ItemProperty -LiteralPath $winlogon -Name DefaultPassword -ErrorAction SilentlyContinue
$processors=@(Get-CimInstance -ClassName Win32_Processor)
if($processors.Count -lt 1 -or $processors.Count -gt 2 -or @($processors|Where-Object {$_.Architecture -ne 9 -or $_.Name -cne $processors[0].Name}).Count -ne 0) { throw 'Actual homogeneous AMD64 virtual processors required' }
$disk=Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
$tpm=Get-Tpm
$spec=Get-CimInstance -Namespace 'root\CIMV2\Security\MicrosoftTpm' -ClassName Win32_Tpm
$version=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$record=[ordered]@{schema='japp-win11-protected-machine-v1';nonce=$config.nonce;boot_time=$os.LastBootUpTime.ToUniversalTime().ToString('o');caption=$os.Caption;product_type=[int]$os.ProductType;architecture=$env:PROCESSOR_ARCHITECTURE;build=[int]$version.CurrentBuildNumber;ubr=[int]$version.UBR;secure_boot=[bool](Confirm-SecureBootUEFI);tpm_present=[bool]$tpm.TpmPresent;tpm_ready=[bool]$tpm.TpmReady;tpm_spec=[string]$spec.SpecVersion;vcpus=[int]$system.NumberOfLogicalProcessors;ram_bytes=[long]$system.TotalPhysicalMemory;disk_bytes=[long]$disk.Size;cpu_name=[string]$processors[0].Name;cpu_architecture='X64';cpu_max_mhz=[int](($processors|Measure-Object -Property MaxClockSpeed -Minimum).Minimum)}
$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath 'C:\ProgramData\JappHarness\machine.json' -Encoding UTF8
'@
Set-Content -LiteralPath (Join-Path $harnessRoot 'machine-attestor.ps1') -Value $attestor -Encoding UTF8
$action = New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument '-NoProfile -ExecutionPolicy RemoteSigned -File C:\ProgramData\JappHarness\machine-attestor.ps1'
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName 'JappOwnedMachineAttestation' -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
# Explorer's normal startup runs this as the created standard user, with UAC unchanged.
$startup = 'C:\Users\Default\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup'
New-Item -ItemType Directory -Path $startup -Force | Out-Null
Set-Content -LiteralPath (Join-Path $startup 'JappFixture.cmd') -Encoding ASCII -Value '@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy RemoteSigned -File "C:\ProgramData\JappHarness\windows11_guest.ps1" -Configuration "C:\ProgramData\JappHarness\guest-config.json"'
