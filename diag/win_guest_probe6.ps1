# DIAGNOSTIC SCRATCH ONLY - never merge.
# Round 6: the packaged desktop app reports "Unavailable after a service failure".
# Trace japp-orchestrator.exe start/stop (WMI), capture the desktop app's own
# stdout/stderr, and collect Application event log and WER records, for a
# direct launch from an ASCII path and from the guest's Unicode/spaces path.
param([Parameter(Mandatory=$true)][string]$Zip,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$clock=[Diagnostics.Stopwatch]::StartNew()
$log=New-Object Collections.ArrayList
New-Item -ItemType Directory -Force -Path $Out | Out-Null
function Note([string]$Key,$Value) {
    [void]$log.Add([ordered]@{t=[Math]::Round($clock.Elapsed.TotalSeconds,3);key=$Key;value=$Value})
    $log|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $Out 'probe.json') -Encoding UTF8
}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.IO.Compression.FileSystem
$events=[Collections.ArrayList]::Synchronized((New-Object Collections.ArrayList))
Register-CimIndicationEvent -ClassName Win32_ProcessStartTrace -SourceIdentifier japp-start -MessageData $events -Action { $e=$Event.SourceEventArgs.NewEvent; if($e.ProcessName -match 'japp|desktop'){ [void]$Event.MessageData.Add([ordered]@{kind='start';name=$e.ProcessName;pid=$e.ProcessID;ppid=$e.ParentProcessID;at=(Get-Date).ToString('o')}) } } | Out-Null
Register-CimIndicationEvent -ClassName Win32_ProcessStopTrace -SourceIdentifier japp-stop -MessageData $events -Action { $e=$Event.SourceEventArgs.NewEvent; if($e.ProcessName -match 'japp|desktop'){ [void]$Event.MessageData.Add([ordered]@{kind='stop';name=$e.ProcessName;pid=$e.ProcessID;exit=$e.ExitStatus;at=(Get-Date).ToString('o')}) } } | Out-Null
function Title([int]$ProcessId) {
    try {
        $condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty,$ProcessId)
        $window=[Windows.Automation.AutomationElement]::RootElement.FindFirst([Windows.Automation.TreeScope]::Children,$condition)
        if($null -eq $window){return $null}; return $window.Current.Name
    } catch { return '<uia error>' }
}
$since=Get-Date
$roots=[ordered]@{ascii='C:\japp-probe-ascii';unicode=(Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('JobApply '+[char]0x03A9+' space probe'))}
foreach($key in $roots.Keys) {
    [IO.Compression.ZipFile]::ExtractToDirectory($Zip,$roots[$key])
    $events.Clear()
    $stdout=Join-Path $Out ($key+'-desktop.stdout'); $stderr=Join-Path $Out ($key+'-desktop.stderr')
    $process=Start-Process -FilePath (Join-Path $roots[$key] 'desktop.exe') -WorkingDirectory $roots[$key] -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $titles=New-Object Collections.ArrayList; $last=$null
    $deadline=$clock.Elapsed.TotalSeconds+75
    while($clock.Elapsed.TotalSeconds -lt $deadline) {
        $title=Title $process.Id
        if($title -cne $last) { [void]$titles.Add(@{t=[Math]::Round($clock.Elapsed.TotalSeconds,2);title=$title}); $last=$title }
        if($null -ne $title -and $title -like '*failed*') { Start-Sleep -Seconds 3; break }
        Start-Sleep -Milliseconds 100
    }
    Note ($key+'-titles') @($titles)
    Note ($key+'-process-events') @($events.ToArray())
    Get-Process -Name desktop,japp-orchestrator -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Note ($key+'-desktop-stderr') ((Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue) -as [string])
    Note ($key+'-desktop-stdout') ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) -as [string])
}
$records=@(Get-WinEvent -FilterHashtable @{LogName='Application';StartTime=$since} -ErrorAction SilentlyContinue | Where-Object { $_.LevelDisplayName -in 'Error','Warning' -or $_.ProviderName -match 'Error Reporting|Application Error' } | Select-Object -First 40 | ForEach-Object { @{time=$_.TimeCreated.ToString('o');provider=$_.ProviderName;id=$_.Id;message=($_.Message -as [string]).Substring(0,[Math]::Min(1500,($_.Message -as [string]).Length))} })
Note 'application-events' $records
foreach($dir in @((Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\WER\ReportArchive'),(Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\WER\ReportQueue'),'C:\ProgramData\Microsoft\Windows\WER\ReportArchive','C:\ProgramData\Microsoft\Windows\WER\ReportQueue')) {
    if(Test-Path -LiteralPath $dir) { foreach($report in @(Get-ChildItem -LiteralPath $dir -Directory | Where-Object { $_.Name -match 'japp|desktop' })) { $wer=Get-ChildItem -LiteralPath $report.FullName -Filter 'Report.wer' -ErrorAction SilentlyContinue; Note 'wer' @{dir=$report.FullName;report=$(if($wer){(Get-Content -LiteralPath $wer.FullName -Raw).Substring(0,4000)}else{$null})} } }
}
Note 'end' @{}
