param([Parameter(Mandatory=$true)][string]$Proof)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if($PSVersionTable.PSEdition -ne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'Actual Windows PowerShell5.1 parser/compiler required' }
if(Test-Path -LiteralPath $Proof) { throw 'Fresh source-check receipt required' }
$names=@('windows11_source_check.ps1','windows11_bootstrap.ps1','windows11_guest.ps1','windows11_owned.cs')
$before=[ordered]@{}
foreach($name in $names) {
    $path=Join-Path $PSScriptRoot $name
    $before[$name]=@{bytes=(Get-Item -LiteralPath $path).Length;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()}
    if($name.EndsWith('.ps1')) {
        $tokens=$null; $errors=$null
        [void][Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
        if($errors.Count -ne 0) { throw ('Target PowerShell parser rejected '+$name+': '+($errors|ForEach-Object {$_.ErrorId} | Select-Object -First 5)) }
    }
}
# Only compile declarations. Never construct OwnedApp or call a native import.
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
    $references=@((Join-Path $framework 'System.dll'),(Join-Path $framework 'System.Core.dll'),(Join-Path $framework 'System.Drawing.dll'),(Join-Path $framework 'WPF\UIAutomationClient.dll'),(Join-Path $framework 'WPF\UIAutomationTypes.dll'),(Join-Path $framework 'WPF\WindowsBase.dll'))
    Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'windows11_owned.cs') -Raw) -ReferencedAssemblies $references
if([JobApplyValidation.OwnedApp].FullName -cne 'JobApplyValidation.OwnedApp') { throw 'Expected compiled type unavailable' }
foreach($name in $names) {
    $path=Join-Path $PSScriptRoot $name
    if((Get-Item -LiteralPath $path).Length -ne $before[$name].bytes -or (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -cne $before[$name].sha256) { throw 'Source changed during static target checks' }
}
$parent=Split-Path -Parent $Proof
New-Item -ItemType Directory -Path $parent -Force | Out-Null
[ordered]@{schema='japp-win11-target-source-check-v1';status='WINDOWS_POWERSHELL51_PARSE_AND_CS_COMPILE_PASS';files=$before;PowerShell=$PSVersionTable.PSVersion.ToString();native_API_calls=0;VMs=0;product_launches=0;Windows11_acceptance=$false}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $Proof -Encoding UTF8
