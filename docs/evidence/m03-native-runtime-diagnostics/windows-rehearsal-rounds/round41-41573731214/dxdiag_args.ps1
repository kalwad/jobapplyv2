# DIAGNOSTIC SCRATCH ONLY - never merge. Round 41: does the owned launcher's
# argument quoting make dxdiag /x write nothing? Same image, switches and output
# directory; only the command-line quoting differs. No product, no VM.
param([Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
$source=Get-Content -LiteralPath 'diag/repo-root/scripts/windows11/windows11_owned.cs' -Raw
Add-Type -TypeDefinition $source -ReferencedAssemblies $references
# The candidate correction: quote only an argument that needs it (CRT rules otherwise unchanged).
$marker='        static string QuoteArgument(string value) {'
$guard='                throw new ArgumentException("Bounded literal argument required");'
if(([regex]::Matches($source,[regex]::Escape($marker))).Count -ne 1 -or ([regex]::Matches($source,[regex]::Escape($guard))).Count -ne 1) { throw 'QuoteArgument anchor changed' }
$minimal=$source.Replace($guard,$guard+"`n            if(value.Length>0&&value.IndexOfAny(new char[]{' ','\t','\""'})<0) return value;").Replace('namespace JobApplyValidation {','namespace JobApplyValidationMinimal {')
Add-Type -TypeDefinition $minimal -ReferencedAssemblies $references
$dxdiag='C:\Windows\System32\dxdiag.exe'
$rows=New-Object Collections.ArrayList
$short=$env:TEMP
$long=[Environment]::GetFolderPath('LocalApplicationData')
function Probe([string]$Name,[scriptblock]$Launch,[string]$Path) {
    $watch=[Diagnostics.Stopwatch]::StartNew()
    $detail=$null
    try { $detail=& $Launch } catch { $detail='launch error: '+$_.Exception.GetType().FullName+': '+$_.Exception.Message }
    while($watch.Elapsed.TotalSeconds -lt 120 -and -not (Test-Path -LiteralPath $Path)) { Start-Sleep -Milliseconds 500 }
    $bytes=$(if(Test-Path -LiteralPath $Path){(Get-Item -LiteralPath $Path).Length}else{-1})
    $stray=@(Get-ChildItem -LiteralPath (Split-Path $Path) -Filter '*.xml' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-3) } | ForEach-Object { $_.Name+'='+$_.Length })
    [void]$rows.Add([ordered]@{probe=$Name;path=$Path;detail=[string]$detail;file_bytes=$bytes;ms=$watch.ElapsedMilliseconds;recent_xml_in_dir=$stray})
}
$i=0
foreach($base in @($short,$long)) {
    foreach($kind in @('owned-quoted','owned-minimal','process-quoted','process-bare','startprocess')) {
        $i++
        $path=Join-Path $base ('JappDx-'+$i+'-'+('a'*64)+'.xml')
        switch($kind) {
            'owned-quoted' { Probe $kind { $o=New-Object JobApplyValidation.OwnedApp; try { $o.StartCommand($dxdiag,@('/whql:off','/x',$path)); 'empty='+$o.WaitEmpty(90000) } finally { $o.Dispose() } } $path }
            'owned-minimal' { Probe $kind { $o=New-Object JobApplyValidationMinimal.OwnedApp; try { $o.StartCommand($dxdiag,@('/whql:off','/x',$path)); 'empty='+$o.WaitEmpty(90000) } finally { $o.Dispose() } } $path }
            'process-quoted' { Probe $kind { $p=[Diagnostics.Process]::Start((New-Object Diagnostics.ProcessStartInfo($dxdiag,('"/whql:off" "/x" "'+$path+'"')) -Property @{UseShellExecute=$false})); [void]$p.WaitForExit(90000); 'exit='+$p.ExitCode } $path }
            'process-bare' { Probe $kind { $p=[Diagnostics.Process]::Start((New-Object Diagnostics.ProcessStartInfo($dxdiag,('/whql:off /x '+$path)) -Property @{UseShellExecute=$false})); [void]$p.WaitForExit(90000); 'exit='+$p.ExitCode } $path }
            'startprocess' { Probe $kind { $p=Start-Process -FilePath $dxdiag -ArgumentList @('/whql:off','/x',$path) -PassThru; [void]$p.WaitForExit(90000); 'exit='+$p.ExitCode } $path }
        }
    }
}
[ordered]@{scope='DIAGNOSTIC_ONLY_NOT_ACCEPTANCE';os=(Get-CimInstance Win32_OperatingSystem).Caption;build=[Environment]::OSVersion.Version.ToString();powershell=$PSVersionTable.PSVersion.ToString();probes=@($rows)}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $Out 'dxdiag-args.json') -Encoding UTF8
Get-Content -LiteralPath (Join-Path $Out 'dxdiag-args.json')
